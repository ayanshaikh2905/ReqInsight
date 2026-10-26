import csv
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline


def normalize_for_grouping(text: str) -> str:
    """Key used to keep identical requirements on the same side of a train/test split."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


class ClassificationService:
    """Classify requirements as Functional or Non-Functional, and predict the
    quality category (Security, Usability, Performance, ...) of Non-Functional ones.

    Training data: PROMISE_exp (Lima et al., SBES 2019), 969 expert-labelled
    requirements from 47 projects, stored in ``data/sample/promise_exp.csv``.

    Model: word uni/bi-gram TF-IDF + Complement Naive Bayes. Among the configurations
    compared in ``scripts/benchmark.py`` it matched the others under 10-fold
    cross-validation and generalised best to unseen projects (leave-one-project-out).

    A few attribute rules run before the model so that requirements about the same
    attribute (e.g. "response time", "JSON format") always get the same type. Every
    rule was audited against PROMISE_exp; rules that were wrong more often than right
    on real data (login, data storage, online/offline) were removed.
    """

    DATASET_PATH = Path(__file__).resolve().parents[3] / "data" / "sample" / "promise_exp.csv"

    ATTRIBUTE_RULES = [
        ("Non-Functional", [
            r"\b(response\s*time|latency|respond within)\b",
            r"\baccuracy\b\s*(?:of|:)?\s*\d",
            r"\b(?:input|request|prompt|document)\s+length\b",
            r"\b(?:maximum|minimum|at\s+least|at\s+most)\s+\d+\s+(?:words?|characters?|tokens?)\b",
            r"\b(passwords?|password)\b.*\b(?:characters?|chars?)\b",
            r"\b(availability|reliability|security|performance|throughput|scalability|speed)\b",
            r"\b(anonymous|unauthenticated|unauthori[sz]ed)\b",
        ]),
        ("Functional", [
            r"\b(?:input|output)\s+format\b|\b(?:json|xml|csv|yaml)\s+format\b",
            r"\b(?:english|french|spanish|german|arabic)\s+language\b|\blanguage\s+support\b",
        ]),
    ]

    RULE_CONFIDENCE = 0.95

    def __init__(
        self,
        training_data: Optional[Sequence[Tuple[str, str]]] = None,
        category_data: Optional[Sequence[Tuple[str, str]]] = None,
    ):
        if training_data is None:
            records = self.load_records()
            training_data = [(r["text"], r["label"]) for r in records]
            if category_data is None:
                category_data = [(r["text"], r["subclass"]) for r in records if r["label"] == "Non-Functional"]
        self.training_data = list(training_data)
        self.category_data = list(category_data or [])
        self.type_model: Optional[Pipeline] = None
        self.category_model: Optional[Pipeline] = None
        self._fit()

    # ------------------------------------------------------------------ data
    @classmethod
    def load_records(cls) -> List[Dict[str, str]]:
        if not cls.DATASET_PATH.exists():
            return []
        with cls.DATASET_PATH.open("r", encoding="utf-8", newline="") as handle:
            return [
                {
                    "text": row["RequirementText"].strip(),
                    "label": row["Class"].strip(),
                    "subclass": (row.get("SubClass") or "").strip(),
                    "project": (row.get("ProjectID") or "").strip(),
                }
                for row in csv.DictReader(handle)
                if row.get("RequirementText") and row.get("Class")
            ]

    @classmethod
    def load_dataset(cls) -> List[Tuple[str, str]]:
        return [(r["text"], r["label"]) for r in cls.load_records()]

    @classmethod
    def split_dataset(
        cls, n_splits: int = 4, random_state: int = 42
    ) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]]]:
        """Stratified hold-out split (25% test by default). Identical requirement texts
        are kept on the same side, so no test sentence is ever seen in training."""
        dataset = cls.load_dataset()
        if not dataset:
            return [], []
        texts = [t for t, _ in dataset]
        labels = [l for _, l in dataset]
        groups = [normalize_for_grouping(t) for t in texts]
        splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=random_state)
        train_idx, test_idx = next(splitter.split(texts, labels, groups))
        return [dataset[i] for i in train_idx], [dataset[i] for i in test_idx]

    # ----------------------------------------------------------------- model
    @staticmethod
    def build_model() -> Pipeline:
        """The text model used for both the type and the NFR-category prediction."""
        return Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, strip_accents="unicode")),
            ("clf", ComplementNB(alpha=0.3)),
        ])

    def _fit(self) -> None:
        if self.training_data and len({l for _, l in self.training_data}) > 1:
            texts, labels = zip(*self.training_data)
            self.type_model = self.build_model().fit(texts, labels)
        if self.category_data and len({l for _, l in self.category_data}) > 1:
            texts, labels = zip(*self.category_data)
            self.category_model = self.build_model().fit(texts, labels)

    @classmethod
    def classify_attribute(cls, text: str) -> Optional[str]:
        lower = text.lower()
        for label, patterns in cls.ATTRIBUTE_RULES:
            if any(re.search(pattern, lower) for pattern in patterns):
                return label
        return None

    def predict_type(self, text: str, use_rules: bool = True) -> Tuple[str, float, str]:
        if use_rules:
            rule_type = self.classify_attribute(text)
            if rule_type:
                return rule_type, self.RULE_CONFIDENCE, "Rule-based attribute policy"
        if self.type_model is None:
            return "Functional", 0.5, "Rule-based fallback"
        probabilities = self.type_model.predict_proba([text])[0]
        best = int(probabilities.argmax())
        return (
            str(self.type_model.classes_[best]),
            round(float(probabilities[best]), 2),
            "Model prediction (TF-IDF + Complement Naive Bayes, PROMISE_exp)",
        )

    def predict_category(self, text: str) -> Tuple[Optional[str], Optional[float]]:
        if self.category_model is None:
            return None, None
        probabilities = self.category_model.predict_proba([text])[0]
        best = int(probabilities.argmax())
        return str(self.category_model.classes_[best]), round(float(probabilities[best]), 2)

    def classify(self, text: str) -> Dict[str, Any]:
        req_type, confidence, source = self.predict_type(text)
        category, category_confidence = (None, None)
        if req_type == "Non-Functional":
            category, category_confidence = self.predict_category(text)
        return {
            "type": req_type,
            "confidence": confidence,
            "classification_source": source,
            "nfr_category": category,
            "nfr_category_confidence": category_confidence,
        }

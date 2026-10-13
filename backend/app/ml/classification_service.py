import csv
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split


class ClassificationService:
    """Classify requirements as Functional or Non-Functional.

    Deployment constraints, accuracy thresholds, response-time limits, and input-length
    limits are Non-Functional. Input/output formats and language support are Functional.
    Attribute rules run before the statistical fallback so requirements about one
    attribute receive a consistent type.
    """

    DATASET_PATH = Path(__file__).resolve().parents[3] / "data" / "sample" / "promise_nfr_sample.csv"
    ATTRIBUTE_RULES = [
        ("Non-Functional", [
            r"\b(response\s*time|latency|respond within)\b",
            r"\baccuracy\b\s*(?:of|:)?\s*\d",
            r"\b(?:input|request|prompt|document)\s+length\b",
            r"\b(?:maximum|minimum|at\s+least|at\s+most)\s+\d+\s+(?:words?|characters?|tokens?)\b",
                r"\b(offline|online|cloud)\b",
            r"\b(passwords?|password)\b.*\b(?:characters?|chars?)\b",
            r"\b(availability|reliability|security|performance|throughput|scalability|speed)\b",
        ]),
        ("Functional", [
            r"\b(?:input|output)\s+format\b|\b(?:json|xml|csv|yaml)\s+format\b|\bformat\b",
            r"\b(?:english|french|spanish|german|arabic)\s+language\b|\blanguage\s+support\b",
            r"\b(login|log\s*in|authenticate|anonymous|unauthenticated)\b",
            r"\b(store|retain|persist|delete|erase|retention)\b",
        ]),
    ]

    def __init__(self, training_data: Optional[Sequence[Tuple[str, str]]] = None):
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.model: Optional[LogisticRegression] = None
        self.transformer_pipeline = None
        self.training_data = list(training_data) if training_data is not None else self.load_dataset()
        self._init_benchmark_classifier()

    @classmethod
    def load_dataset(cls) -> List[Tuple[str, str]]:
        if not cls.DATASET_PATH.exists():
            return []
        with cls.DATASET_PATH.open("r", encoding="utf-8", newline="") as handle:
            rows = csv.DictReader(handle)
            return [
                (row["RequirementText"].strip(), row["Class"].strip())
                for row in rows
                if row.get("RequirementText") and row.get("Class")
            ]

    @classmethod
    def split_dataset(
        cls, test_size: float = 0.25, random_state: int = 42
    ) -> Tuple[List[Tuple[str, str]], List[Tuple[str, str]]]:
        dataset = cls.load_dataset()
        if not dataset:
            return [], []
        texts, labels = zip(*dataset)
        train_texts, test_texts, train_labels, test_labels = train_test_split(
            list(texts), list(labels), test_size=test_size, random_state=random_state, stratify=list(labels)
        )
        return list(zip(train_texts, train_labels)), list(zip(test_texts, test_labels))

    def _init_benchmark_classifier(self) -> None:
        if not self.training_data:
            return
        texts, labels = zip(*self.training_data)
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 3), min_df=1, sublinear_tf=True, strip_accents="unicode"
        )
        features = self.vectorizer.fit_transform(texts)
        self.model = LogisticRegression(C=2.5, max_iter=200, class_weight="balanced")
        self.model.fit(features, labels)

    def _classify_attribute(self, lower: str) -> Optional[str]:
        for label, patterns in self.ATTRIBUTE_RULES:
            if any(re.search(pattern, lower) for pattern in patterns):
                return label
        return None

    def classify(self, text: str) -> Dict[str, Any]:
        lower = text.lower()
        rule_type = self._classify_attribute(lower)
        if rule_type:
            return {
                "type": rule_type,
                "confidence": 0.95,
                "classification_source": "Rule-based attribute policy",
            }

        if self.model is None or self.vectorizer is None:
            return {
                "type": "Functional",
                "confidence": 0.5,
                "classification_source": "Rule-based fallback",
            }

        probabilities = self.model.predict_proba(self.vectorizer.transform([text]))[0]
        classes = list(self.model.classes_)
        predicted_index = int(probabilities.argmax())
        predicted_type = classes[predicted_index]
        return {
            "type": predicted_type,
            "confidence": round(float(probabilities[predicted_index]), 2),
            "classification_source": "Model prediction (TF-IDF + Logistic Classifier)",
        }

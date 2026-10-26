import json
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import GroupKFold, StratifiedGroupKFold

from backend.app.ml.ambiguity_service import AmbiguityService
from backend.app.ml.classification_service import ClassificationService, normalize_for_grouping
from backend.app.ml.similarity_service import SimilarityService


DUPLICATE_THRESHOLD = 0.78
CV_FOLDS = 10
CATEGORY_CV_FOLDS = 5
RANDOM_STATE = 42


def _r(value: float) -> float:
    return round(float(value), 3)


def _per_class(y_true: List[str], y_pred: List[str], labels: List[str]) -> Dict[str, Dict[str, Any]]:
    p, r, f, s = precision_recall_fscore_support(y_true, y_pred, labels=labels, zero_division=0)
    return {
        label: {"precision": _r(p[i]), "recall": _r(r[i]), "f1_score": _r(f[i]), "support": int(s[i])}
        for i, label in enumerate(labels)
    }


def evaluate_type_classification(records: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """Functional vs Non-Functional on PROMISE_exp.

    * 10-fold stratified cross-validation: every requirement is predicted exactly once
      by a model that never saw it. Identical texts are kept in the same fold.
    * Leave-one-project-out: train on 46 projects, test on the 47th, for all 47.
    * Majority-class baseline, and the trained model with and without attribute rules.
    """
    records = records if records is not None else ClassificationService.load_records()
    texts = [r["text"] for r in records]
    labels = np.array([r["label"] for r in records])
    subclasses = [r["subclass"] for r in records]
    dup_groups = [normalize_for_grouping(t) for t in texts]
    projects = [r["project"] for r in records]
    class_names = sorted(set(labels))

    def fit(train_idx) -> ClassificationService:
        return ClassificationService(
            training_data=[(texts[i], labels[i]) for i in train_idx],
            category_data=[(texts[i], subclasses[i]) for i in train_idx if labels[i] == "Non-Functional"],
        )

    # 10-fold cross-validation, deployed configuration (rules + model) and model only.
    pred_deployed = np.empty(len(texts), dtype=object)
    pred_model = np.empty(len(texts), dtype=object)
    fold_acc: List[float] = []
    splitter = StratifiedGroupKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    for train_idx, test_idx in splitter.split(texts, labels, dup_groups):
        service = fit(train_idx)
        for i in test_idx:
            pred_deployed[i] = service.predict_type(texts[i])[0]
            pred_model[i] = service.predict_type(texts[i], use_rules=False)[0]
        fold_acc.append(accuracy_score(labels[test_idx], pred_deployed[test_idx]))

    p_mac, r_mac, f_mac, _ = precision_recall_fscore_support(labels, pred_deployed, average="macro", zero_division=0)
    _, _, f_w, _ = precision_recall_fscore_support(labels, pred_deployed, average="weighted", zero_division=0)
    _, _, f_model, _ = precision_recall_fscore_support(labels, pred_model, average="macro", zero_division=0)

    # Leave-one-project-out (deployed configuration).
    pred_lopo = np.empty(len(texts), dtype=object)
    n_projects = len(set(projects))
    for train_idx, test_idx in GroupKFold(n_splits=n_projects).split(texts, labels, projects):
        service = fit(train_idx)
        for i in test_idx:
            pred_lopo[i] = service.predict_type(texts[i])[0]
    _, _, f_lopo, _ = precision_recall_fscore_support(labels, pred_lopo, average="macro", zero_division=0)

    # How often the attribute rules decide, and how often they are right.
    rule_hits = [i for i, t in enumerate(texts) if ClassificationService.classify_attribute(t)]
    rule_correct = sum(ClassificationService.classify_attribute(texts[i]) == labels[i] for i in rule_hits)

    majority = max(class_names, key=lambda c: int((labels == c).sum()))
    return {
        "accuracy": _r(accuracy_score(labels, pred_deployed)),
        "precision": _r(p_mac),
        "recall": _r(r_mac),
        "f1_score": _r(f_mac),
        "averaging": "macro (both classes weighted equally)",
        "f1_weighted": _r(f_w),
        "accuracy_std": _r(np.std(fold_acc)),
        "fold_accuracies": [_r(a) for a in fold_acc],
        "sample_size": len(texts),
        "training_size": len(texts) - len(texts) // CV_FOLDS,
        "n_projects": n_projects,
        "protocol": f"{CV_FOLDS}-fold stratified cross-validation; each requirement is tested once by a model that never saw it",
        "cross_project": {
            "accuracy": _r(accuracy_score(labels, pred_lopo)),
            "f1_score": _r(f_lopo),
            "protocol": f"Leave-one-project-out over {n_projects} projects",
        },
        "baseline": {
            "accuracy": _r((labels == majority).mean()),
            "description": f"Always predict '{majority}'",
        },
        "model_only": {
            "accuracy": _r(accuracy_score(labels, pred_model)),
            "f1_score": _r(f_model),
        },
        "rules": {
            "requirements_decided": len(rule_hits),
            "accuracy": _r(rule_correct / len(rule_hits)) if rule_hits else None,
        },
        "confusion_matrix": {
            "labels": class_names,
            "matrix": confusion_matrix(labels, pred_deployed, labels=class_names).tolist(),
        },
        "per_class": _per_class(list(labels), list(pred_deployed), class_names),
        "model_description": "TF-IDF (word 1-2 grams) + Complement Naive Bayes, with audited attribute rules",
        "dataset": "PROMISE_exp (Lima et al., SBES 2019)",
    }


def evaluate_nfr_category(records: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """Which quality category (Security, Usability, ...) a Non-Functional requirement
    belongs to: 11 classes, 5-fold stratified cross-validation on the NFR subset."""
    records = records if records is not None else ClassificationService.load_records()
    nfr = [r for r in records if r["label"] == "Non-Functional" and r["subclass"]]
    texts = [r["text"] for r in nfr]
    labels = np.array([r["subclass"] for r in nfr])
    groups = [normalize_for_grouping(t) for t in texts]
    class_names = sorted(set(labels))

    pred = np.empty(len(texts), dtype=object)
    splitter = StratifiedGroupKFold(n_splits=CATEGORY_CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    for train_idx, test_idx in splitter.split(texts, labels, groups):
        model = ClassificationService.build_model().fit([texts[i] for i in train_idx], labels[train_idx])
        pred[test_idx] = model.predict([texts[i] for i in test_idx])

    p, r, f, _ = precision_recall_fscore_support(labels, pred, average="macro", zero_division=0)
    _, _, f_w, _ = precision_recall_fscore_support(labels, pred, average="weighted", zero_division=0)
    majority = max(class_names, key=lambda c: int((labels == c).sum()))
    return {
        "accuracy": _r(accuracy_score(labels, pred)),
        "precision": _r(p),
        "recall": _r(r),
        "f1_score": _r(f),
        "f1_weighted": _r(f_w),
        "averaging": "macro (every category weighted equally, including rare ones)",
        "sample_size": len(texts),
        "n_classes": len(class_names),
        "protocol": f"{CATEGORY_CV_FOLDS}-fold stratified cross-validation",
        "baseline": {"accuracy": _r((labels == majority).mean()), "description": f"Always predict '{majority}'"},
        "per_class": _per_class(list(labels), list(pred), class_names),
        "method": "TF-IDF (word 1-2 grams) + Complement Naive Bayes",
    }


class EvaluationService:
    """Measured evaluation of the analysis pipeline.

    1. Requirement type (Functional / Non-Functional): PROMISE_exp, 969 requirements,
       10-fold cross-validation plus leave-one-project-out.
    2. NFR category (11 classes): the 525 Non-Functional requirements of PROMISE_exp.
    3. Ambiguity and 4. duplicate detection: small hand-written sanity sets
       (``data/sample/evaluation_benchmark.json``), reported with their size.

    Every number is computed from the data when requested; nothing is hardcoded.
    """

    BENCHMARK_PATH = Path(__file__).resolve().parents[3] / "data" / "sample" / "evaluation_benchmark.json"

    def __init__(self):
        self.ambiguity_service = AmbiguityService()
        self.similarity_service = SimilarityService()
        self.benchmark_ambiguity_set, self.benchmark_duplicates_set = self._load_benchmark()
        self._cached: Optional[Dict[str, Any]] = None
        self._lock = threading.Lock()

    @classmethod
    def _load_benchmark(cls):
        with cls.BENCHMARK_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data["ambiguity"], data["duplicates"]

    def run_evaluation(self, refresh: bool = False) -> Dict[str, Any]:
        """Returns benchmark metrics. The services and data are deterministic, so the
        result is computed once and cached; pass ``refresh=True`` to recompute."""
        with self._lock:
            if self._cached is None or refresh:
                self._cached = self._compute_evaluation()
            return self._cached

    def _evaluate_ambiguity(self) -> Dict[str, Any]:
        y_true, y_pred = [], []
        for text, gold in self.benchmark_ambiguity_set:
            y_true.append(gold)
            y_pred.append(self.ambiguity_service.detect_ambiguity(text)["is_ambiguous"])
        p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
        return {
            "accuracy": _r(accuracy_score(y_true, y_pred)),
            "precision": _r(p),
            "recall": _r(r),
            "f1_score": _r(f),
            "sample_size": len(self.benchmark_ambiguity_set),
            "method": "Lexical and syntactic rules for vague terms and unmeasurable quality claims",
            "note": "Small hand-written sanity set; no large public labelled ambiguity dataset is available.",
        }

    def _evaluate_duplicates(self) -> Dict[str, Any]:
        y_true, y_pred = [], []
        for text_a, text_b, gold in self.benchmark_duplicates_set:
            emb = self.similarity_service.encode([text_a, text_b])
            sim = float(self.similarity_service.compute_similarity_matrix(emb)[0][1])
            y_true.append(gold)
            y_pred.append(sim >= DUPLICATE_THRESHOLD)
        backend = self.similarity_service.embedding_backend
        backend_label = (
            "Sentence-BERT embeddings" if backend == "sentence-transformers"
            else "calibrated char+word TF-IDF (offline fallback)"
        )
        p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="binary", zero_division=0)
        return {
            "accuracy": _r(accuracy_score(y_true, y_pred)),
            "precision": _r(p),
            "recall": _r(r),
            "f1_score": _r(f),
            "sample_size": len(self.benchmark_duplicates_set),
            "method": f"Cosine similarity on {backend_label} (threshold: {DUPLICATE_THRESHOLD})",
            "embedding_backend": backend,
            "note": "Small hand-written sanity set of requirement pairs.",
        }

    def _compute_evaluation(self) -> Dict[str, Any]:
        started = time.perf_counter()
        records = ClassificationService.load_records()
        classification = evaluate_type_classification(records)
        nfr_category = evaluate_nfr_category(records)
        result = {
            "classification": classification,
            "nfr_category": nfr_category,
            "ambiguity": self._evaluate_ambiguity(),
            "duplicates": self._evaluate_duplicates(),
            "text_generation": {
                "status": "not_evaluated",
                "evaluation_method": "BLEU/ROUGE require gold reference rewrites; add a "
                                     "'rewrites' list to evaluation_benchmark.json to enable.",
            },
            "dataset_info": {
                "primary_datasets": [
                    f"PROMISE_exp: {classification['sample_size']} requirements, {classification['n_projects']} projects",
                ],
                "citation": "Lima, M., Valle, V., Costa, E., Lira, F., Gadelha, B. (2019). Software Engineering "
                            "Repositories: Expanding the PROMISE Database. SBES 2019.",
                "note": "Type and category scores come from cross-validation on PROMISE_exp: every requirement is "
                        "predicted by a model that was not trained on it. Ambiguity and duplicate scores use small "
                        "hand-written sets and are sanity checks only.",
            },
            "evaluation_type": "Measured on PROMISE_exp (969 requirements) with cross-validation",
        }
        result["dataset_info"]["compute_seconds"] = round(time.perf_counter() - started, 2)
        return result

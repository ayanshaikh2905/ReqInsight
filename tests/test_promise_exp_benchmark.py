from collections import Counter

import pytest

from backend.app.ml.classification_service import ClassificationService
from backend.app.services.evaluation_service import evaluate_nfr_category, evaluate_type_classification


def test_promise_exp_dataset_is_complete():
    records = ClassificationService.load_records()
    assert len(records) == 969
    assert len({r["project"] for r in records}) == 47
    assert Counter(r["label"] for r in records) == {"Non-Functional": 525, "Functional": 444}
    assert all(r["subclass"] for r in records if r["label"] == "Non-Functional")
    assert not any(r["subclass"] for r in records if r["label"] == "Functional")


def test_non_functional_requirements_get_a_category():
    service = ClassificationService()
    nfr = service.classify("Only authorized users shall be able to access patient records.")
    assert nfr["type"] == "Non-Functional"
    assert nfr["nfr_category"] == "Security"
    assert 0 < nfr["nfr_category_confidence"] <= 1

    fr = service.classify("The system shall allow the user to add items to the shopping cart.")
    assert fr["type"] == "Functional"
    assert fr["nfr_category"] is None


@pytest.fixture(scope="module")
def type_metrics():
    return evaluate_type_classification()


def test_every_requirement_is_tested_exactly_once(type_metrics):
    matrix = type_metrics["confusion_matrix"]["matrix"]
    assert sum(map(sum, matrix)) == 969
    assert len(type_metrics["fold_accuracies"]) == 10


def test_classifier_clearly_beats_the_majority_baseline(type_metrics):
    baseline = type_metrics["baseline"]["accuracy"]
    assert type_metrics["accuracy"] > baseline + 0.25
    assert type_metrics["cross_project"]["accuracy"] > baseline + 0.15


def test_nfr_category_beats_the_majority_baseline():
    metrics = evaluate_nfr_category()
    assert metrics["sample_size"] == 525
    assert metrics["n_classes"] == 11
    assert metrics["accuracy"] > metrics["baseline"]["accuracy"] + 0.3

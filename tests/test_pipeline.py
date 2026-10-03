import pytest
import os
from backend.app.services.extractor_service import ExtractorService
from backend.app.ml.classification_service import ClassificationService
from backend.app.ml.similarity_service import SimilarityService
from backend.app.ml.ambiguity_service import AmbiguityService
from backend.app.ml.incompleteness_service import IncompletenessService
from backend.app.ml.smell_service import SmellService
from backend.app.ml.conflict_service import ConflictService
from backend.app.ml.quality_scorer import QualityScorer
from backend.app.services.pipeline_service import AnalysisPipeline
from backend.app.utils.document_parser import DocumentParser


def test_extractor():
    extractor = ExtractorService()
    text = """
    REQ-001: The system shall allow users to reset their password.
    REQ-002: The system should be very fast.
    """
    reqs = extractor.extract_requirements(text)
    assert len(reqs) == 2
    assert reqs[0]["id"] == "REQ-001"
    assert "reset their password" in reqs[0]["text"]


def test_classification():
    classifier = ClassificationService()
    res_f = classifier.classify("The system shall allow users to log in using their credentials.")
    assert res_f["type"] == "Functional"
    assert res_f["confidence"] >= 0.5

    res_nf = classifier.classify("The system shall respond within 2 seconds under peak load.")
    assert res_nf["type"] == "Non-Functional"


def test_similarity_and_duplicates():
    sim_service = SimilarityService()
    reqs = [
        {"id": "REQ-001", "text": "Users can reset their password."},
        {"id": "REQ-002", "text": "Users can change their forgotten password."},
        {"id": "REQ-003", "text": "The database transactions shall be encrypted using AES-256."}
    ]
    duplicates = sim_service.find_duplicates(reqs, threshold=0.75)
    assert len(duplicates) >= 1
    assert duplicates[0]["req_a_id"] in ["REQ-001", "REQ-002"]
    assert duplicates[0]["req_b_id"] in ["REQ-001", "REQ-002"]


def test_ambiguity_detection():
    amb_service = AmbiguityService()
    res1 = amb_service.detect_ambiguity("The system should be very fast.")
    assert res1["is_ambiguous"] is True
    assert any("fast" in t for t in res1["ambiguous_terms"])

    res2 = amb_service.detect_ambiguity("The system shall respond within 500 milliseconds.")
    assert res2["is_ambiguous"] is False


def test_incompleteness_detection():
    inc_service = IncompletenessService()
    res1 = inc_service.detect_incompleteness("The system shall generate reports.")
    assert res1["is_incomplete"] is True


def test_conflict_detection():
    conflict_service = ConflictService()
    reqs = [
        {"id": "REQ-009", "text": "Passwords must contain at least 8 characters."},
        {"id": "REQ-010", "text": "Passwords must contain a maximum of 6 characters."}
    ]
    conflicts = conflict_service.find_conflicts(reqs)
    assert len(conflicts) == 1
    assert conflicts[0]["conflict_type"] == "Incompatible Numeric Constraint"


def test_quality_scorer():
    scorer = QualityScorer()
    res = scorer.calculate_score(
        text="The system should be very fast.",
        is_ambiguous=True,
        ambiguous_terms=["fast"],
        is_incomplete=False,
        missing_elements=[],
        has_conflict=False,
        has_duplicate=False,
        similarity_max=0.3,
        req_type="Non-Functional"
    )
    assert res["overall_score"] < 70
    assert "scores" in res
    assert "recommendation" in res


def test_end_to_end_pipeline():
    pipeline = AnalysisPipeline()
    sample_text = """
    REQ-001: The system shall allow registered users to log in using their credentials.
    REQ-002: The system should be very fast.
    REQ-003: The system shall respond within 2 seconds.
    REQ-004: Users can reset their password.
    REQ-005: Users can change their forgotten password.
    REQ-006: Passwords must contain at least 8 characters.
    REQ-007: Passwords must contain a maximum of 6 characters.
    """
    res = pipeline.run_pipeline(sample_text, "Test Run")
    assert res["summary"]["total_requirements"] == 7
    assert len(res["duplicates"]) >= 1
    assert len(res["conflicts"]) >= 1
    assert res["summary"]["average_quality_score"] > 0

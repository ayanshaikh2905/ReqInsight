import numpy as np

from backend.app.ml.quality_scorer import QualityScorer
from backend.app.ml.similarity_service import SimilarityService
from backend.app.services.pipeline_service import AnalysisPipeline


def test_scoring_uses_word_boundaries_and_safe_slashes():
    scorer = QualityScorer()
    base = dict(
        is_ambiguous=False, ambiguous_terms=[], is_incomplete=False,
        missing_elements=[], has_conflict=False, has_duplicate=False,
        similarity_max=0.3, req_type="Functional",
    )
    scan = scorer.calculate_score("The scanner shall use TCP/IP and operate 24/7.", **base)
    alternative = scorer.calculate_score("The system shall support JSON / XML output.", **base)

    assert scan["scores"]["clarity"] == 95
    assert alternative["scores"]["clarity"] < scan["scores"]["clarity"]


def test_duplicate_flag_never_increases_uniqueness():
    scorer = QualityScorer()
    result = scorer.calculate_score(
        "The system shall process requests.", False, [], False, [], False, True, 0.3, "Functional"
    )
    assert result["scores"]["uniqueness"] < 95


def test_tfidf_fallback_handles_empty_texts_and_pipeline_reports_backend():
    service = SimilarityService()
    service._get_sbert = lambda: None
    embeddings = service.encode(["!!!", "???"])
    assert embeddings.shape == (2, 1)
    assert service.embedding_backend == "tfidf-fallback"

    summary = AnalysisPipeline().run_pipeline(
        "REQ-001: The system shall allow users to log in using credentials."
    )["summary"]
    assert summary["embedding_backend"] in {"sentence-transformers", "tfidf-fallback"}


def test_quality_bucket_includes_score_74_in_moderate():
    pipeline = AnalysisPipeline()
    summary = pipeline._compute_summary(
        [{"type": "Functional", "is_ambiguous": False, "is_incomplete": False, "quality_score": 74, "smells": []}],
        [], [], [],
    )
    assert summary["quality_distribution"]["Moderate (60-74)"] == 1
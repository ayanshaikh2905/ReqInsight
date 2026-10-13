from pathlib import Path

from backend.app.services.pipeline_service import AnalysisPipeline


FIXTURES = Path(__file__).parent / "fixtures"


def test_with_issues_fixture_has_expected_findings():
    result = AnalysisPipeline().run_pipeline((FIXTURES / "with_issues.txt").read_text(encoding="utf-8"))
    ambiguity_ids = {r["id"] for r in result["requirements"] if r["is_ambiguous"]}
    duplicate_pairs = {(p["req_a_id"], p["req_b_id"]) for p in result["duplicates"]}
    conflict_pairs = {(p["req_a_id"], p["req_b_id"]) for p in result["conflicts"]}

    assert {"REQ-003", "REQ-005", "REQ-012", "REQ-018", "REQ-019"} <= ambiguity_ids
    assert ("REQ-006", "REQ-013") in duplicate_pairs
    assert conflict_pairs == {
        ("REQ-008", "REQ-009"),
        ("REQ-010", "REQ-011"),
        ("REQ-014", "REQ-015"),
        ("REQ-016", "REQ-017"),
    }


def test_clean_fixture_has_no_conflicts_duplicates_or_ambiguity():
    result = AnalysisPipeline().run_pipeline((FIXTURES / "clean_srs.txt").read_text(encoding="utf-8"))

    assert result["conflicts"] == []
    assert result["duplicates"] == []
    assert not any(requirement["is_ambiguous"] for requirement in result["requirements"])
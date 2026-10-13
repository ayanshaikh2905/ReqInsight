from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.api import routes
from backend.app.main import app
from backend.app.reports.corrected_srs_builder import CorrectedSRSBuilder


builder = CorrectedSRSBuilder()
client = TestClient(app)


def requirement(req_id, text, score=70, section="Core", line_number=1, improved_text=""):
    return {
        "id": req_id,
        "text": text,
        "original_text": text,
        "section": section,
        "line_number": line_number,
        "improved_text": improved_text,
        "quality_score": score,
        "recommendation": "Review this wording.",
    }


def analysis(requirements, duplicates=None, conflicts=None):
    return {
        "document_name": "Test SRS",
        "requirements": requirements,
        "duplicates": duplicates or [],
        "conflicts": conflicts or [],
    }


def test_reworded_requirement_uses_improved_text_and_changelog():
    result = builder.build(analysis([requirement("REQ-1", "The system is fast", improved_text="The system shall respond quickly.")]))
    item = result["sections"][0]["requirements"][0]
    assert item["corrected_text"] == "The system shall respond quickly."
    assert item["status"] == "reworded"
    assert any(change["change_type"] == "reworded" for change in result["changelog"])


def test_duplicate_pair_keeps_higher_quality_requirement():
    reqs = [requirement("REQ-1", "A", score=60), requirement("REQ-2", "B", score=90, line_number=2)]
    result = builder.build(analysis(reqs, [{"req_a_id": "REQ-1", "req_b_id": "REQ-2", "similarity": 0.9}]))
    ids = [item["id"] for section in result["sections"] for item in section["requirements"]]
    assert ids == ["REQ-2"]
    assert result["merged_duplicates"][0]["removed_id"] == "REQ-1"


def test_duplicate_chain_has_one_survivor():
    reqs = [requirement("A", "A", 80), requirement("B", "B", 95, line_number=2), requirement("C", "C", 70, line_number=3)]
    pairs = [
        {"req_a_id": "A", "req_b_id": "B", "similarity": 0.9},
        {"req_a_id": "B", "req_b_id": "C", "similarity": 0.91},
    ]
    result = builder.build(analysis(reqs, pairs))
    assert [item["id"] for section in result["sections"] for item in section["requirements"]] == ["B"]
    assert {item["removed_id"] for item in result["merged_duplicates"]} == {"A", "C"}


def test_conflict_keeps_originals_and_is_not_merged():
    reqs = [requirement("REQ-1", "At least 8 characters"), requirement("REQ-2", "At most 6 characters", line_number=2)]
    conflicts = [{"req_a_id": "REQ-1", "req_b_id": "REQ-2", "conflict_type": "threshold", "explanation": "Different limits."}]
    result = builder.build(analysis(reqs, conflicts=conflicts))
    items = [item for section in result["sections"] for item in section["requirements"]]
    assert {item["status"] for item in items} == {"needs_decision"}
    assert [item["corrected_text"] for item in items] == ["At least 8 characters", "At most 6 characters"]
    assert len(result["needs_decision"]) == 1
    assert not result["merged_duplicates"]


def test_conflict_takes_precedence_over_duplicate():
    reqs = [requirement("REQ-1", "A"), requirement("REQ-2", "B", score=99, line_number=2)]
    duplicates = [{"req_a_id": "REQ-1", "req_b_id": "REQ-2", "similarity": 0.99}]
    conflicts = [{"req_a_id": "REQ-1", "req_b_id": "REQ-2", "conflict_type": "value", "explanation": "Conflict."}]
    result = builder.build(analysis(reqs, duplicates, conflicts))
    assert not result["merged_duplicates"]
    assert all(item["status"] == "needs_decision" for section in result["sections"] for item in section["requirements"])


def test_placeholders_are_collected():
    req = requirement("REQ-1", "The system uses [Information required: format] in [Information required: language].")
    result = builder.build(analysis([req]))
    assert len(result["open_items"]) == 2


def test_no_requirement_is_lost():
    reqs = [requirement("A", "A"), requirement("B", "B", line_number=2), requirement("C", "C", line_number=3)]
    result = builder.build(analysis(reqs, [{"req_a_id": "A", "req_b_id": "B", "similarity": 0.9}]))
    section_ids = {item["id"] for section in result["sections"] for item in section["requirements"]}
    removed_ids = {item["removed_id"] for item in result["merged_duplicates"]}
    assert len(section_ids | removed_ids) == 3


def test_empty_analysis_does_not_crash():
    result = builder.build({})
    assert result["summary"]["total"] == 0
    assert result["sections"] == []


def test_corrected_exports_and_json_after_demo():
    assert client.get("/api/demo-srs").status_code == 200
    result = client.get("/api/corrected-srs")
    assert result.status_code == 200
    assert "sections" in result.json()
    docx = client.get("/api/export/corrected/docx")
    pdf = client.get("/api/export/corrected/pdf")
    txt = client.get("/api/export/corrected/txt")
    assert docx.status_code == pdf.status_code == txt.status_code == 200
    assert docx.content and pdf.content.startswith(b"%PDF") and txt.content


def test_corrected_bad_format_returns_400():
    assert client.get("/api/export/corrected/xml").status_code == 400


def test_no_active_analysis_returns_clear_error(monkeypatch):
    monkeypatch.setattr(routes, "current_analysis", None)
    monkeypatch.setattr(routes.db, "get_latest_analysis", lambda: None)
    monkeypatch.setattr(routes, "DEMO_SRS_PATH", Path("does-not-exist.txt"))
    response = client.get("/api/corrected-srs")
    assert response.status_code == 404
    assert "No active analysis" in response.json()["detail"]


def test_clear_conflicts_integration():
    fixture = Path(__file__).parent / "fixtures" / "clear_conflicts.txt"
    result = routes.pipeline.run_pipeline(fixture.read_text(encoding="utf-8"), "clear_conflicts.txt")
    corrected = builder.build(result)
    decision_pairs = {frozenset((item["req_a_id"], item["req_b_id"])) for item in corrected["needs_decision"]}
    for conflict in result.get("conflicts", []):
        assert frozenset((conflict["req_a_id"], conflict["req_b_id"])) in decision_pairs
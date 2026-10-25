from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.models.database import DatabaseManager
from backend.app.services.comparison_service import ComparisonService
from backend.app.services.pipeline_service import AnalysisPipeline

client = TestClient(app)
FIXTURES = Path(__file__).parent / "fixtures"
DEMO = Path(__file__).resolve().parents[1] / "data" / "sample" / "demo_srs.txt"


def _analyze(text: str, name: str) -> dict:
    res = client.post("/api/analyze", json={"text": text, "document_name": name})
    assert res.status_code == 200, res.text
    return res.json()


def test_back_to_back_runs_get_unique_ids(tmp_path):
    db = DatabaseManager(str(tmp_path / "runs.db"))
    analysis = {"document_name": "x", "summary": {"total_requirements": 1}, "requirements": []}
    ids = {db.save_analysis("DOC", "x.txt", "text", analysis) for _ in range(5)}
    assert len(ids) == 5  # previously collided within the same second
    assert db.get_latest_analysis()["run_id"] in ids
    assert len(db.list_runs()) == 5


def test_history_lists_activates_and_deletes_runs():
    first = _analyze(DEMO.read_text(encoding="utf-8"), "History v1")
    second = _analyze(
        "REQ-001: The system shall export invoices as PDF within 5 seconds.", "History v2"
    )
    runs = client.get("/api/history").json()
    ids = [r["run_id"] for r in runs]
    assert ids.index(second["run_id"]) < ids.index(first["run_id"])  # newest first

    activated = client.post(f"/api/history/{first['run_id']}/activate")
    assert activated.status_code == 200
    assert client.get("/api/report").json()["document_name"] == "History v1"

    assert client.delete(f"/api/history/{second['run_id']}").status_code == 200
    assert client.get(f"/api/history/{second['run_id']}").status_code == 404
    assert client.delete(f"/api/history/{second['run_id']}").status_code == 404


def test_compare_detects_fixed_conflict_and_new_vague_requirement():
    base = _analyze(DEMO.read_text(encoding="utf-8"), "Demo v1")
    target = _analyze((FIXTURES / "demo_srs_revised.txt").read_text(encoding="utf-8"), "Demo v2")

    res = client.get("/api/compare", params={"base": base["run_id"], "target": target["run_id"]})
    assert res.status_code == 200, res.text
    diff = res.json()

    assert diff["verdict"] == "improved"
    assert diff["summary_delta"]["average_quality_score"]["direction"] == "better"
    assert diff["summary_delta"]["total_requirements"]["direction"] in {"neutral", "same"}

    resolved = {frozenset((c["req_a_id"], c["req_b_id"])) for c in diff["conflicts"]["resolved"]}
    assert frozenset(("REQ-012", "REQ-013")) in resolved

    added_ids = {r["id"] for r in diff["requirements"]["added"]}
    removed_ids = {r["id"] for r in diff["requirements"]["removed"]}
    assert "REQ-019" in added_ids
    assert {"REQ-005", "REQ-010", "REQ-013"} <= removed_ids

    # Reworded under the same ID is a change, not a delete + add.
    changed = {c["target_id"]: c for c in diff["requirements"]["changed"]}
    assert "REQ-004" in changed and changed["REQ-004"]["text_changed"]
    assert diff["issues"]["resolved"] > diff["issues"]["introduced"]


def test_compare_validates_input():
    run = client.get("/api/history").json()[0]["run_id"]
    assert client.get("/api/compare", params={"base": run, "target": run}).status_code == 400
    assert client.get("/api/compare", params={"base": run, "target": "RUN-missing"}).status_code == 404


def test_matching_survives_renumbering():
    base = [{"id": "REQ-001", "text": "Passwords must contain at least 8 characters.", "quality_score": 80}]
    target = [
        {"id": "REQ-001", "text": "The system shall export invoices as PDF.", "quality_score": 90},
        {"id": "REQ-002", "text": "Passwords must contain at least 8 characters.", "quality_score": 80},
    ]
    matches = ComparisonService().match_requirements(base, target)
    assert matches == [(0, 1, 1.0)]


def test_conflict_detection_matches_pairwise_reference():
    """Extract-once conflict detection must equal the original pairwise check."""
    pipeline = AnalysisPipeline()
    reqs = pipeline.extractor.extract_requirements(DEMO.read_text(encoding="utf-8"))
    fast = pipeline.conflicts.find_conflicts(reqs)
    reference = []
    for i, a in enumerate(reqs):
        for b in reqs[i + 1:]:
            if pipeline.conflicts.check_pair_conflict(a["text"], b["text"], 0.5):
                reference.append((a["id"], b["id"]))
    assert [(c["req_a_id"], c["req_b_id"]) for c in fast] == reference


def test_duplicate_threshold_reuses_matrix_and_excludes_conflicts():
    client.get("/api/demo-srs")
    loose = client.get("/api/duplicates", params={"threshold": 0.5}).json()
    conflicts = client.get("/api/conflicts").json()
    conflict_pairs = {frozenset((c["req_a_id"], c["req_b_id"])) for c in conflicts}
    assert all(frozenset((d["req_a_id"], d["req_b_id"])) not in conflict_pairs for d in loose)
    strict = client.get("/api/duplicates", params={"threshold": 0.95}).json()
    assert len(strict) <= len(loose)


def test_settings_never_return_api_key():
    saved = client.post("/api/settings", json={"llm_provider": "fallback", "llm_api_key": "sk-secret"}).json()
    assert saved["llm_api_key"] == "" and saved["llm_api_key_set"] is True
    fetched = client.get("/api/settings").json()
    assert fetched["llm_api_key"] == "" and fetched["llm_api_key_set"] is True
    # Saving again with a blank key keeps the stored key.
    again = client.post("/api/settings", json={"llm_provider": "fallback", "llm_api_key": ""}).json()
    assert again["llm_api_key_set"] is True


def test_bad_input_is_a_client_error():
    assert client.post("/api/analyze", json={"text": "   "}).status_code == 400
    res = client.post(
        "/api/upload",
        files={"file": ("notes.xyz", b"hello", "application/octet-stream")},
    )
    assert res.status_code == 400
    assert client.post("/api/settings", json={"similarity_threshold": 2}).status_code == 422


def test_repeated_requirement_ids_are_made_unique():
    pipeline = AnalysisPipeline()
    reqs = pipeline.extractor.extract_requirements(
        "REQ-001: The system shall log users in.\nREQ-001: The system shall log users out."
    )
    assert [r["id"] for r in reqs] == ["REQ-001", "REQ-001-2"]

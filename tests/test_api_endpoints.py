from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_root_and_health():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["project"] == "ReqInsight AI"

    res_h = client.get("/health")
    assert res_h.status_code == 200
    assert res_h.json()["status"] == "ok"


def test_demo_srs():
    res = client.get("/api/demo-srs")
    assert res.status_code == 200
    data = res.json()
    assert "summary" in data
    assert data["summary"]["total_requirements"] > 0
    assert "requirements" in data
    assert len(data["requirements"]) > 0


def test_get_requirements():
    res = client.get("/api/requirements")
    assert res.status_code == 200
    reqs = res.json()
    assert isinstance(reqs, list)
    assert len(reqs) > 0


def test_duplicates_and_conflicts():
    res_dup = client.get("/api/duplicates")
    assert res_dup.status_code == 200
    assert isinstance(res_dup.json(), list)

    res_conf = client.get("/api/conflicts")
    assert res_conf.status_code == 200
    assert isinstance(res_conf.json(), list)


def test_topics_and_metrics():
    res_top = client.get("/api/topics")
    assert res_top.status_code == 200

    res_met = client.get("/api/metrics")
    assert res_met.status_code == 200
    data = res_met.json()
    assert "classification" in data
    assert "ambiguity" in data
    assert "duplicates" in data


def test_generation_endpoints():
    res_rw = client.post("/api/rewrite", json={"text": "The system should be very fast."})
    assert res_rw.status_code == 200
    assert "improved_text" in res_rw.json()

    res_us = client.post("/api/user-story", json={"text": "The system shall allow customers to track orders."})
    assert res_us.status_code == 200
    assert "user_story" in res_us.json()
    assert "As a customer" in res_us.json()["user_story"]

    res_ac = client.post("/api/acceptance-criteria", json={"text": "The system shall allow users to log in."})
    assert res_ac.status_code == 200
    assert "acceptance_criteria" in res_ac.json()


def test_exports():
    res_json = client.get("/api/export/json")
    assert res_json.status_code == 200
    assert res_json.headers["content-type"] == "application/json"

    res_csv = client.get("/api/export/csv")
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers["content-type"]

    res_pdf = client.get("/api/export/pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"

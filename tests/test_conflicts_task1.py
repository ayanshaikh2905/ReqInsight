from pathlib import Path

from backend.app.ml.conflict_service import ConflictService
from backend.app.services.extractor_service import ExtractorService


EXPECTED_PAIRS = {
    ("REQ-001", "REQ-002"),
    ("REQ-003", "REQ-004"),
    ("REQ-005", "REQ-006"),
    ("REQ-007", "REQ-008"),
    ("REQ-009", "REQ-010"),
    ("REQ-011", "REQ-012"),
    ("REQ-013", "REQ-014"),
    ("REQ-015", "REQ-016"),
}


def test_clear_conflicts_fixture_has_exact_pairs():
    fixture = Path(__file__).parent / "fixtures" / "clear_conflicts.txt"
    requirements = ExtractorService().extract_requirements(fixture.read_text(encoding="utf-8"))
    conflicts = ConflictService().find_conflicts(requirements)
    pairs = {(c["req_a_id"], c["req_b_id"]) for c in conflicts}

    assert pairs == EXPECTED_PAIRS
    assert all(c["attribute"] and c["value_a"] and c["value_b"] for c in conflicts)


def test_password_length_regression():
    requirements = [
        {"id": "REQ-009", "text": "Passwords must contain at least 8 characters."},
        {"id": "REQ-010", "text": "Passwords must contain a maximum of 6 characters."},
    ]

    conflicts = ConflictService().find_conflicts(requirements)

    assert len(conflicts) == 1
    assert conflicts[0]["conflict_type"] == "Incompatible Numeric Constraint"
    assert conflicts[0]["attribute"] == "password_length"

from backend.app.ml.ambiguity_service import AmbiguityService
from backend.app.ml.smell_service import SmellService


def test_stemmed_vague_terms_and_escape_phrases_are_detected():
    result = AmbiguityService().detect_ambiguity(
        "The system should respond quickly, provide adequate results where feasible, and be easy to use."
    )

    assert result["is_ambiguous"] is True
    assert any("quick" in term for term in result["ambiguous_terms"])
    assert "where feasible" in result["ambiguous_terms"]
    assert "easy to use" in result["ambiguous_terms"]


def test_quality_attribute_requires_a_measurement_in_its_sentence():
    service = AmbiguityService()
    measurable = service.detect_ambiguity("The classifier shall achieve accuracy of 95%.")
    unmeasurable = service.detect_ambiguity("The classifier shall provide high accuracy.")

    assert "non-measurable" not in measurable["ambiguous_terms"]
    assert "non-measurable" in unmeasurable["ambiguous_terms"]


def test_smell_service_uses_measurement_units_for_quality_attributes():
    service = SmellService()
    clean = service.detect_smells("The service shall maintain 99.9% availability.")
    smells = service.detect_smells("The service shall maintain high availability.")

    assert not any(smell["smell"] == "Non-Measurable Constraint" for smell in clean)
    assert any(smell["smell"] == "Non-Measurable Constraint" for smell in smells)

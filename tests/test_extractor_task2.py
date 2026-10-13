from backend.app.services.extractor_service import ExtractorService


def test_sentence_starting_with_number_is_not_treated_as_requirement_id():
    extractor = ExtractorService()
    requirements = extractor.extract_requirements(
        "The 30 second timeout shall apply to all requests."
    )

    assert len(requirements) == 1
    assert requirements[0]["id"] == "REQ-001"
    assert "30 second timeout" in requirements[0]["text"]


def test_list_marker_starts_a_new_requirement():
    extractor = ExtractorService()
    requirements = extractor.extract_requirements(
        "REQ-001: The system shall authenticate users.\n"
        "- The 30 second timeout shall apply to all requests."
    )

    assert [requirement["id"] for requirement in requirements] == ["REQ-001", "REQ-002"]
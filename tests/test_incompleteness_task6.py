from backend.app.ml.incompleteness_service import IncompletenessService


def test_be_considered_is_not_flagged_as_agentless_passive():
    result = IncompletenessService().detect_incompleteness(
        "The system shall be considered acceptable with an accuracy of 60% on the test dataset."
    )

    assert result["is_incomplete"] is False


def test_action_passive_without_agent_is_flagged_explicitly():
    result = IncompletenessService().detect_incompleteness("Reports shall be generated.")

    assert result["is_incomplete"] is True
    assert "Passive Voice Without Agent" in result["missing_elements"]
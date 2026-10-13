from backend.app.ml.classification_service import ClassificationService


def test_classification_split_has_no_text_leakage():
    training, held_out = ClassificationService.split_dataset()
    assert training
    assert held_out
    assert {text for text, _ in training}.isdisjoint({text for text, _ in held_out})


def test_shared_attributes_have_consistent_types():
    service = ClassificationService()
    pairs = [
        ("The service shall accept English language input.", "The service shall reject English language input."),
        ("The service shall return JSON format.", "The service shall return XML format."),
        ("The service shall require login.", "The service shall allow anonymous access."),
        ("The service shall operate offline.", "The service shall operate online."),
        ("The classifier shall achieve accuracy of 95%.", "The classifier shall achieve accuracy of 60%"),
        ("The service shall accept a maximum input length of 100 words.", "The service shall accept a minimum input length of 500 words."),
    ]

    for first, second in pairs:
        assert service.classify(first)["type"] == service.classify(second)["type"]
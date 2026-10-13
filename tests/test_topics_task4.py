from backend.app.ml.topic_service import TopicService


def test_topic_matching_uses_word_boundaries():
    service = TopicService()

    label = service._generate_topic_label(["tokenization", "normalization"], ["The system performs tokenization and normalization."])

    assert "Authentication" not in label
    assert "Run" not in label
    assert "Only" not in label


def test_known_domain_requires_two_terms_unless_term_is_strong():
    service = TopicService()

    one_term = service._generate_topic_label(["login"], ["The service shall support login."])
    two_terms = service._generate_topic_label(["login", "password"], ["The service shall support login and password reset."])

    assert one_term != "Authentication & Access"
    assert two_terms == "Authentication & Access"
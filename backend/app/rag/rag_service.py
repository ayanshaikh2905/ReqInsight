from typing import List, Dict, Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class RAGService:
    """
    Retrieval-Augmented Generation (RAG) Service for Software Requirements Engineering.
    Maintains an indexed knowledge base of IEEE 830, ISO/IEC/IEEE 29148 standards,
    requirement smells, testability rules, and Given-When-Then patterns.
    """

    KNOWLEDGE_BASE = [
        {
            "id": "KB-01",
            "topic": "IEEE 830 Requirement Atomicity & Clarity",
            "text": "A software requirement must be unambiguous, singular, and atomic. Sentences containing multiple conjunctions like 'and/or' or running over 35 words must be decomposed into distinct individual functional requirements."
        },
        {
            "id": "KB-02",
            "topic": "ISO 29148 Measurable Quality Attributes",
            "text": "Non-functional requirements must define objective, quantifiable constraints. Vague adjectives such as 'fast', 'scalable', or 'user-friendly' are unacceptable without explicit units (e.g. milliseconds, concurrent sessions, percentage uptime)."
        },
        {
            "id": "KB-03",
            "topic": "Requirement Smell: Subjective Phrasing",
            "text": "Subjective terms express unmeasurable feelings (e.g. 'easy to use', 'intuitive', 'seamless'). Rewriting must replace subjective qualifiers with standardized benchmarks like System Usability Scale (SUS > 80)."
        },
        {
            "id": "KB-04",
            "topic": "Requirement Smell: Permissive / Weak Modalities",
            "text": "Modal verbs 'can', 'may', 'might', or 'should' indicate optionality or escape clauses. Contractual software requirements must use 'shall' or 'must' to establish binding commitments."
        },
        {
            "id": "KB-05",
            "topic": "Agile User Story Synthesis (INVEST Principle)",
            "text": "User stories follow the format 'As a [role], I want [goal], so that [value]'. The role must represent a distinct stakeholder (e.g., Customer, Administrator), not a vague entity."
        },
        {
            "id": "KB-06",
            "topic": "Gherkin Acceptance Criteria Standards",
            "text": "Acceptance criteria must follow Given-When-Then syntax. 'Given' specifies preconditions; 'When' represents the user or system trigger; 'Then' verifies observable, deterministic outcomes."
        },
        {
            "id": "KB-07",
            "topic": "Conflict Resolution in Requirements",
            "text": "Contradictory constraints (e.g., minimum password length of 8 vs maximum password length of 6) violate consistency. The specification must be reconciled by aligning security standards with usability constraints."
        },
        {
            "id": "KB-08",
            "topic": "Security and Encryption Engineering Guidelines",
            "text": "Security requirements must explicitly cite cipher suites, protocol versions (e.g., TLS 1.3, AES-256), and cryptographic salt policies rather than relying on the vague word 'secure'."
        }
    ]

    def __init__(self):
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        texts = [doc["topic"] + " " + doc["text"] for doc in self.KNOWLEDGE_BASE]
        self.doc_vectors = self.vectorizer.fit_transform(texts)

    def retrieve(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        """
        Retrieves top-k relevant requirement engineering guidelines
        for a given requirement query.
        """
        q_vec = self.vectorizer.transform([query])
        similarities = cosine_similarity(q_vec, self.doc_vectors)[0]
        
        ranked_indices = np.argsort(similarities)[::-1][:top_k]
        results = []
        for idx in ranked_indices:
            score = float(similarities[idx])
            if score > 0.05:
                item = dict(self.KNOWLEDGE_BASE[idx])
                item["relevance_score"] = round(score, 3)
                results.append(item)

        # Fallback if no specific keyword match
        if not results:
            results = [dict(self.KNOWLEDGE_BASE[0])]
            results[0]["relevance_score"] = 0.5

        return results

    def build_augmented_context(self, requirement_text: str) -> str:
        """
        Formats retrieved knowledge chunks into structured contextual guidelines
        for LLM prompt augmentation.
        """
        retrieved_docs = self.retrieve(requirement_text, top_k=2)
        guidelines = "\n".join([f"- [{doc['topic']}]: {doc['text']}" for doc in retrieved_docs])
        return f"RELEVANT REQUIREMENTS ENGINEERING GUIDELINES:\n{guidelines}"

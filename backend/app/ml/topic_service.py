import re
from typing import List, Dict, Any, Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import MiniBatchKMeans, AgglomerativeClustering


class TopicService:
    """
    Requirement Topic Discovery Service.
    Discovers domain clusters dynamically from SRS requirements using:
      1. c-TF-IDF keyword extraction per cluster.
      2. Sentence embeddings + Agglomerative / KMeans clustering fallback.
    Does not restrict clustering to rigid predefined lists.
    """

    # Domain vocabulary cues for descriptive labeling when cluster words correlate
    KNOWN_DOMAINS = {
        "Authentication & Access": ["login", "password", "credential", "auth", "oauth", "jwt", "session", "token", "mfa"],
        "Security & Compliance": ["encrypt", "aes", "tls", "gdpr", "hipaa", "permission", "role", "audit", "security", "firewall"],
        "Performance & Scalability": ["latency", "throughput", "concurrent", "response", "second", "fast", "load", "uptime", "cache"],
        "Reporting & Analytics": ["report", "export", "pdf", "csv", "chart", "metrics", "analytics", "dashboard", "summary"],
        "User Management": ["account", "profile", "register", "signup", "user", "deactivate", "avatar", "bio"],
        "Payment & Billing": ["payment", "invoice", "credit", "card", "checkout", "billing", "tax", "transaction", "currency"],
        "Notifications & Alerts": ["notification", "email", "sms", "alert", "push", "message", "notify"],
        "Data & Integration": ["database", "backup", "api", "rest", "sync", "storage", "import", "endpoint"],
        "Text Processing": ["tokenize", "normalize", "stem", "lemmatize", "stop word"],
        "Model & Accuracy": ["model", "accuracy", "precision", "recall", "f1", "classifier"],
        "Input & Output Formats": ["json", "xml", "csv", "yaml", "input format", "output format"],
        "Data Privacy & Retention": ["privacy", "retain", "retention", "delete", "personal data", "anonymize"],
    }

    STRONG_DOMAIN_TERMS = {
        "oauth", "jwt", "mfa", "gdpr", "hipaa", "aes", "json", "xml", "tokenize",
        "lemmatize", "precision", "recall", "retention",
    }
    GENERIC_TERMS = {
        "achieve", "return", "support", "only", "minimum", "maximum", "run", "shall",
        "must", "should", "will", "system", "user", "users", "role", "second",
        "the", "and", "for", "with", "that", "this", "from", "are", "can", "allow",
        "able", "all", "each", "any", "when", "into", "their", "requirement",
    }

    def discover_topics(
        self,
        requirements: List[Dict[str, Any]],
        embeddings: Optional[np.ndarray] = None
    ) -> List[Dict[str, Any]]:
        """
        Clusters requirements into meaningful semantic topics and assigns each
        requirement a topic name and cluster ID.
        """
        n = len(requirements)
        if n == 0:
            return []

        texts = [req["text"] for req in requirements]

        # Determine optimal number of clusters k
        if n <= 3:
            k = 1
        elif n <= 8:
            k = min(3, n)
        elif n <= 20:
            k = min(5, n // 2)
        else:
            k = min(8, n // 4)

        cluster_labels = []
        if embeddings is not None and len(embeddings) == n and k > 1:
            try:
                # Use Agglomerative clustering for stable, deterministic clusters
                clustering = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average")
                cluster_labels = clustering.fit_predict(embeddings)
            except Exception:
                kmeans = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3)
                cluster_labels = kmeans.fit_predict(embeddings)
        else:
            # TF-IDF fallback clustering
            vec = TfidfVectorizer(stop_words="english", max_features=100)
            X = vec.fit_transform(texts)
            if k > 1:
                kmeans = MiniBatchKMeans(n_clusters=k, random_state=42, n_init=3)
                cluster_labels = kmeans.fit_predict(X)
            else:
                cluster_labels = [0] * n

        # Extract top keywords per cluster using c-TF-IDF
        cluster_groups: Dict[int, List[int]] = {}
        for idx, label in enumerate(cluster_labels):
            cluster_groups.setdefault(int(label), []).append(idx)

        topics_info: List[Dict[str, Any]] = []

        for cid, member_indices in cluster_groups.items():
            member_texts = [texts[idx] for idx in member_indices]
            req_ids = [requirements[idx]["id"] for idx in member_indices]

            # Extract representative keywords
            keywords = self._extract_keywords(member_texts)
            topic_name = self._generate_topic_label(keywords, member_texts)

            topics_info.append({
                "topic_id": cid,
                "name": topic_name,
                "count": len(member_indices),
                "keywords": keywords,
                "requirement_ids": req_ids
            })

            # Update requirement items directly
            for idx in member_indices:
                requirements[idx]["topic"] = topic_name
                requirements[idx]["topic_id"] = cid

        topics_info.sort(key=lambda t: t["count"], reverse=True)
        return topics_info

    def _extract_keywords(self, texts: List[str]) -> List[str]:
        """Extracts top TF-IDF keywords for a cluster of requirements."""
        joined = " ".join(texts)
        words = re.findall(r"\b[a-zA-Z]{3,15}\b", joined.lower())
        filtered = [w for w in words if w not in self.GENERIC_TERMS]
        if not filtered:
            return ["general"]

        # Frequency count
        counts: Dict[str, int] = {}
        for w in filtered:
            counts[w] = counts.get(w, 0) + 1

        sorted_words = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return [word for word, _ in sorted_words[:5]]

    def _generate_topic_label(self, keywords: List[str], texts: List[str]) -> str:
        """Assigns an intuitive, descriptive title to the topic cluster."""
        combined_text = " ".join(texts).lower()

        # A term match is token-boundary aware, so "token" cannot match "tokenization".
        domain_scores = {}
        for domain, domain_terms in self.KNOWN_DOMAINS.items():
            matched_terms = {
                term for term in domain_terms
                if re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", combined_text)
            }
            domain_scores[domain] = matched_terms

        max_score = max((len(terms) for terms in domain_scores.values()), default=0)
        best_domains = [domain for domain, terms in domain_scores.items() if len(terms) == max_score]
        if len(best_domains) == 1:
            best_domain = best_domains[0]
            matched_terms = domain_scores[best_domain]
            if len(matched_terms) >= 2 or matched_terms & self.STRONG_DOMAIN_TERMS:
                return best_domain

        # Otherwise synthesize from top keywords
        if keywords:
            cap_keywords = [kw.capitalize() for kw in keywords[:2]]
            return " & ".join(cap_keywords)

        return "General System Feature"

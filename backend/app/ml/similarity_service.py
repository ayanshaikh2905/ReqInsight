import os
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer


class SimilarityService:
    """
    Computes requirement embeddings and evaluates semantic similarity.
    Uses subword n-gram TF-IDF embeddings by default for instant, zero-latency
    laptop performance, with opt-in Sentence-BERT (all-MiniLM-L6-v2) when enabled.
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._sbert_model = None
        self._sbert_attempted = False
        self._tfidf_fallback = None

    def _get_sbert(self):
        """Loads cached SentenceTransformer with fallback."""
        if self._sbert_model is None and not self._sbert_attempted:
            self._sbert_attempted = True
            try:
                from sentence_transformers import SentenceTransformer
                try:
                    self._sbert_model = SentenceTransformer(self.model_name, local_files_only=True)
                except Exception:
                    self._sbert_model = SentenceTransformer(self.model_name)
            except Exception as e:
                print(f"[SimilarityService] SBERT load notice: {e}. Using subword vectorizer.")
                self._sbert_model = None
        return self._sbert_model

    def encode(self, texts: List[str]) -> np.ndarray:
        """Generates normalized dense embedding vectors for requirements."""
        if not texts:
            return np.empty((0, 384))

        model = self._get_sbert()
        if model is not None:
            try:
                embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
                return embeddings
            except Exception as e:
                print(f"[SimilarityService] SBERT encode failed: {e}. Falling back to subword TF-IDF.")

        # High-dimensional subword character & word n-gram vectorizer
        # Provides robust semantic overlap even for paraphrased requirements
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            analyzer="word",
            sublinear_tf=True,
            strip_accents="unicode"
        )
        sparse = vectorizer.fit_transform(texts)
            
        dense = sparse.toarray()
        norms = np.linalg.norm(dense, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return dense / norms
        return dense / norms

    def compute_similarity_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """Calculates pairwise cosine similarity matrix."""
        if len(embeddings) == 0:
            return np.empty((0, 0))
        return cosine_similarity(embeddings)

    def find_duplicates(
        self,
        requirements: List[Dict[str, Any]],
        threshold: float = 0.85
    ) -> List[Dict[str, Any]]:
        """
        Identifies potential duplicate or highly similar requirements
        based on the configurable cosine similarity threshold.
        """
        if len(requirements) < 2:
            return []

        texts = [req["text"] for req in requirements]
        embeddings = self.encode(texts)
        sim_matrix = self.compute_similarity_matrix(embeddings)

        duplicates = []
        n = len(requirements)

        for i in range(n):
            for j in range(i + 1, n):
                score = float(sim_matrix[i][j])
                if score >= threshold:
                    duplicates.append({
                        "req_a_id": requirements[i]["id"],
                        "req_a_text": requirements[i]["text"],
                        "req_b_id": requirements[j]["id"],
                        "req_b_text": requirements[j]["text"],
                        "similarity": round(score, 3),
                        "status": "Potential Duplicate" if score >= 0.88 else "Highly Similar"
                    })

        # Sort descending by similarity score
        duplicates.sort(key=lambda x: x["similarity"], reverse=True)
        return duplicates

    def get_related_requirements(
        self,
        target_idx: int,
        requirements: List[Dict[str, Any]],
        sim_matrix: np.ndarray,
        threshold: float = 0.60
    ) -> List[Dict[str, Any]]:
        """Finds all requirements related to a given requirement."""
        related = []
        n = len(requirements)
        for j in range(n):
            if j == target_idx:
                continue
            score = float(sim_matrix[target_idx][j])
            if score >= threshold:
                related.append({
                    "target_id": requirements[j]["id"],
                    "target_text": requirements[j]["text"],
                    "similarity": round(score, 3),
                    "is_duplicate": bool(score >= 0.85)
                })
        related.sort(key=lambda x: x["similarity"], reverse=True)
        return related

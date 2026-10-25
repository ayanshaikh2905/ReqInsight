import os
import re
from typing import List, Dict, Any, Optional

import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize


# Requirements-engineering synonyms that lexical vectors cannot otherwise relate.
# Order matters: more specific phrases are rewritten before their component words.
_SYNONYM_RULES = [
    (r"\bchange(?:s|d)?\s+(?:their\s+|the\s+|a\s+)?(?:forgot(?:ten)?\s+)?password", "reset_password"),
    (r"\b(?:forgot(?:ten)?|reset(?:s|ting)?|recover\w*)\s+(?:their\s+|the\s+|a\s+)?password", "reset_password"),
    (r"\b(?:sign(?:s|ed)?[\s-]?in|log(?:s|ged)?[\s-]?in|login|authenticat\w*)\b", "authenticate"),
    (r"\b(?:sign(?:s|ed)?[\s-]?out|log(?:s|ged)?[\s-]?out|logout)\b", "logout"),
    (r"\b(?:export\w*|generat\w*|download\w*)\b", "produce"),
    (r"\b(?:reports?|records?)\b", "report"),
    (r"\b(?:customers?|clients?|users?|members?)\b", "user"),
    (r"\b(?:remov\w*|delet\w*|eras\w*)\b", "delete"),
    (r"\b(?:show\w*|display\w*|view\w*)\b", "display"),
    (r"\b(?:e-?mails?|notif\w*|alerts?)\b", "notify"),
]
_COMPILED_SYNONYMS = [(re.compile(p), r) for p, r in _SYNONYM_RULES]
_STOPWORDS = re.compile(
    r"\b(?:the|a|an|shall|must|should|will|can|be|to|of|their|its|is|are|able|"
    r"registered|system|using|via|allow|allows)\b"
)


class SimilarityService:
    """
    Computes requirement embeddings and evaluates semantic similarity.

    Backends (``REQINSIGHT_EMBEDDINGS`` env var):
      - ``auto`` (default): Sentence-BERT (all-MiniLM-L6-v2) when installed and the
        model is available, otherwise the lexical fallback.
      - ``sbert``: same as auto, but logs loudly if SBERT cannot load.
      - ``tfidf``: always use the lexical fallback (no torch import, fastest startup).

    The lexical fallback combines character n-grams (robust to inflection) with word
    n-grams over synonym-normalised text, then calibrates the cosine score so its
    scale is comparable to dense-embedding similarity thresholds.
    """

    # Lexical cosine is compressed relative to dense embeddings; a square-root map
    # brings paraphrases (~0.45 raw) and unrelated text (~0.05 raw) onto a scale where
    # the same 0.60 / 0.85 thresholds behave sensibly for both backends.
    LEXICAL_CALIBRATION_EXPONENT = 0.5

    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self.mode = os.getenv("REQINSIGHT_EMBEDDINGS", "auto").lower()
        self._sbert_model = None
        self._sbert_attempted = False
        self.embedding_backend = "tfidf-fallback"

    def _get_sbert(self):
        """Loads cached SentenceTransformer, preferring the local cache."""
        if self.mode == "tfidf":
            return None
        if self._sbert_model is None and not self._sbert_attempted:
            self._sbert_attempted = True
            try:
                from sentence_transformers import SentenceTransformer
                try:
                    self._sbert_model = SentenceTransformer(self.model_name, local_files_only=True)
                except Exception:
                    self._sbert_model = SentenceTransformer(self.model_name)
            except Exception as e:
                print(f"[SimilarityService] SBERT unavailable ({e}). Using lexical fallback.")
                self._sbert_model = None
        return self._sbert_model

    @staticmethod
    def normalize_text(text: str) -> str:
        """Lower-cases, canonicalises domain synonyms and drops modal/filler words."""
        lowered = text.lower()
        for pattern, replacement in _COMPILED_SYNONYMS:
            lowered = pattern.sub(replacement, lowered)
        lowered = _STOPWORDS.sub(" ", lowered)
        return re.sub(r"\s+", " ", lowered).strip()

    def encode(self, texts: List[str]) -> np.ndarray:
        """Generates L2-normalised embedding vectors for requirements."""
        if not texts:
            return np.empty((0, 384))

        model = self._get_sbert()
        if model is not None:
            try:
                embeddings = model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
                self.embedding_backend = "sentence-transformers"
                return embeddings
            except Exception as e:
                print(f"[SimilarityService] SBERT encode failed: {e}. Falling back to lexical vectors.")

        self.embedding_backend = "tfidf-fallback"
        return self._encode_lexical(texts)

    def _encode_lexical(self, texts: List[str]) -> np.ndarray:
        normalized = [self.normalize_text(t) or t.lower() for t in texts]
        if not any(re.search(r"\w", t) for t in normalized):
            # Nothing lexical to compare (e.g. punctuation only).
            return np.zeros((len(texts), 1), dtype=float)
        blocks = []
        for vectorizer in (
            TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True),
            TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, token_pattern=r"(?u)\b\w[\w-]*\b"),
        ):
            try:
                blocks.append(normalize(vectorizer.fit_transform(normalized)))
            except ValueError:
                continue
        if not blocks:
            return np.zeros((len(texts), 1), dtype=float)
        # Equal weighting of both views, kept sparse until the end.
        combined = normalize(hstack(blocks).tocsr())
        return combined.toarray()

    def compute_similarity_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """Pairwise cosine similarity. Inputs are already L2-normalised, so this is a dot product."""
        if len(embeddings) == 0:
            return np.empty((0, 0))
        sim = np.clip(embeddings @ embeddings.T, 0.0, 1.0)
        if self.embedding_backend == "tfidf-fallback":
            sim = np.power(sim, self.LEXICAL_CALIBRATION_EXPONENT)
        np.fill_diagonal(sim, 1.0)
        return sim

    def find_duplicates(
        self,
        requirements: List[Dict[str, Any]],
        threshold: float = 0.85,
        sim_matrix: Optional[np.ndarray] = None,
    ) -> List[Dict[str, Any]]:
        """
        Identifies potential duplicate or highly similar requirements
        based on the configurable cosine similarity threshold.
        """
        if len(requirements) < 2:
            return []

        if sim_matrix is None:
            texts = [req["text"] for req in requirements]
            sim_matrix = self.compute_similarity_matrix(self.encode(texts))

        rows, cols = np.nonzero(np.triu(sim_matrix, k=1) >= threshold)
        duplicates = []
        for i, j in zip(rows.tolist(), cols.tolist()):
            score = float(sim_matrix[i, j])
            duplicates.append({
                "req_a_id": requirements[i]["id"],
                "req_a_text": requirements[i]["text"],
                "req_b_id": requirements[j]["id"],
                "req_b_text": requirements[j]["text"],
                "similarity": round(score, 3),
                "status": "Potential Duplicate" if score >= 0.88 else "Highly Similar"
            })

        duplicates.sort(key=lambda x: x["similarity"], reverse=True)
        return duplicates

    def get_related_requirements(
        self,
        target_idx: int,
        requirements: List[Dict[str, Any]],
        sim_matrix: np.ndarray,
        threshold: float = 0.60,
        duplicate_threshold: float = 0.85,
    ) -> List[Dict[str, Any]]:
        """Finds all requirements related to a given requirement."""
        row = sim_matrix[target_idx]
        candidates = np.nonzero(row >= threshold)[0]
        related = []
        for j in candidates.tolist():
            if j == target_idx:
                continue
            score = float(row[j])
            related.append({
                "target_id": requirements[j]["id"],
                "target_text": requirements[j]["text"],
                "similarity": round(score, 3),
                "is_duplicate": bool(score >= duplicate_threshold)
            })
        related.sort(key=lambda x: x["similarity"], reverse=True)
        return related

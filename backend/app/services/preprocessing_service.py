import re
from typing import List


class PreprocessingService:
    """
    Lightweight, requirement-safe text preprocessing.
    Preserves modal verbs (shall, must, should, will) and negations (not, never, cannot)
    which are essential for requirements engineering semantics.
    """

    @staticmethod
    def normalize_whitespace(text: str) -> str:
        """Replace irregular tabs, carriage returns, and multiple spaces with a single space."""
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Replace non-breaking spaces
        text = text.replace("\u00a0", " ")
        # Consolidate multiple horizontal spaces
        text = re.sub(r"[ \t]+", " ", text)
        return text.strip()

    @staticmethod
    def clean_requirement_text(text: str) -> str:
        """
        Cleans requirement statement while strictly preserving
        modal verbs, punctuation, numbers, and negations.
        """
        text = PreprocessingService.normalize_whitespace(text)
        # Remove bullet markers at the beginning
        text = re.sub(r"^[\s*•\-–—\d+\.\)]+\s*", "", text)
        # Ensure single period at end if it ends like a sentence
        text = text.strip()
        if text and text[-1] not in [".", "!", "?", ";"]:
            text += "."
        return text

    @staticmethod
    def split_sentences(text: str) -> List[str]:
        """
        Sentence splitter that respects requirement IDs and decimals (e.g. 1.2, 2.5s, REQ-001).
        """
        # Protect common abbreviations and numbers
        protected = re.sub(r"(\d+)\.(\d+)", r"\1__DECIMAL__\2", text)
        protected = re.sub(r"(e\.g\.|i\.e\.|etc\.|vs\.|fig\.|sec\.)", r"\1__ABBR__", protected, flags=re.IGNORECASE)
        
        # Split on sentence terminals
        raw_sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])", protected)
        
        cleaned = []
        for s in raw_sentences:
            s = s.replace("__DECIMAL__", ".").replace("__ABBR__", "")
            s = PreprocessingService.normalize_whitespace(s)
            if len(s) > 5:
                cleaned.append(s)
        return cleaned

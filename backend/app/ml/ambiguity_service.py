import re
from typing import Any, Dict, List


class AmbiguityService:
    """Detect lexical vagueness and quality attributes without measurable bounds."""

    VAGUE_TERM_PATTERNS = [
        (r"\bfast\w*\b", "fast", "Response or execution time is unspecified."),
        (r"\bquick\w*\b", "quick", "Expected latency is subjective and lacks a measurable threshold."),
        (r"\bappropriat\w*\b", "appropriate", "Evaluation criteria are subjective and undefined."),
        (r"\breasonabl\w*\b", "reasonable", "The acceptance threshold is open to divergent interpretation."),
        (r"\badequat\w*\b", "adequate", "The adequacy criterion lacks concrete capacity figures."),
        (r"\bsufficient\w*\b", "sufficient", "Sufficiency criteria require explicit quantifiable parameters."),
        (r"\buser[- ]friendly\b", "user-friendly", "Usability is unquantified without empirical metrics."),
        (r"\beasy\s+to\s+use\b", "easy to use", "Usability is subjective without a measurable criterion."),
        (r"\b(high|higher|good|better|best|low|minimal|optimal)\b", "quality modifier", "The quality target is subjective without a measurable threshold."),
    ]

    VAGUE_TERMS = {
        "slow": "Performance degradation boundary is not quantified.",
        "intuitive": "Interface expectations lack concrete user-test specifications.",
        "large": "The capacity threshold is undefined.",
        "small": "The dimension or footprint scale is undefined.",
        "soon": "The temporal deadline or SLA duration is missing.",
        "efficient": "The efficiency metric is unstated.",
        "secure": "The security standard or threat model is unspecified.",
        "robust": "The fault tolerance threshold is not articulated.",
        "flexible": "The scope of flexibility is not specified.",
        "seamless": "The transition behavior is subjective without a defined protocol.",
        "maximum": "The maximum lacks a concrete numeric bound.",
        "etc": "Open-ended enumeration introduces scope ambiguity.",
        "and/or": "The requirement has ambiguous branching verification paths.",
        "as needed": "Trigger conditions and boundaries are undefined.",
        "if possible": "The obligation lacks deterministic testability.",
    }

    VAGUE_QUANTIFIERS = [
        (r"\b(large\s+number\s+of)\b", "Vague quantifier without an explicit limit."),
        (r"\b(several|various|many|few|numerous)\b", "Indefinite quantity without specific numerical bounds."),
        (r"\b(high\s+performance|high\s+availability)\b", "Subjective quality goal requires an engineering metric."),
        (r"\b(state[- ]of[- ]the[- ]art)\b", "Marketing terminology lacks verification criteria."),
        (r"\b(as\s+soon\s+as\s+possible|asap)\b", "Indefinite timeline requires a precise SLA."),
    ]

    QUALITY_ATTRIBUTES = (
        "accuracy", "performance", "availability", "reliability", "security",
        "speed", "throughput", "scalability",
    )
    MEASUREMENT_PATTERN = re.compile(
        r"\b\d+(?:[,.]\d+)?\s*(?:%|percent|ms|milliseconds?|s|sec|seconds?|min|minutes?|"
        r"hours?|days?|words?|characters?|chars?|requests?|users?|records?|mb|gb|kb)?\b",
        re.IGNORECASE,
    )

    def detect_ambiguity(self, text: str) -> Dict[str, Any]:
        lower = text.lower()
        ambiguous_terms: List[str] = []
        explanations: List[str] = []

        for pattern, _, explanation in self.VAGUE_TERM_PATTERNS:
            match = re.search(pattern, lower)
            if match:
                ambiguous_terms.append(match.group(0))
                explanations.append(f"Contains vague term '{match.group(0)}': {explanation}")

        for term, explanation in self.VAGUE_TERMS.items():
            if re.search(r"\b" + re.escape(term) + r"\b", lower):
                ambiguous_terms.append(term)
                explanations.append(f"Contains vague term '{term}': {explanation}")

        for phrase in ("where possible", "if applicable", "as applicable", "where feasible", "and so on"):
            if phrase in lower:
                ambiguous_terms.append(phrase)
                explanations.append(f"Contains open-ended condition '{phrase}'.")

        for pattern, explanation in self.VAGUE_QUANTIFIERS:
            match = re.search(pattern, lower)
            if match:
                matched = match.group(0)
                if matched not in ambiguous_terms:
                    ambiguous_terms.append(matched)
                    explanations.append(explanation)

        if re.search(r"\b(respond|response\s+time|latency)\b", lower) and not re.search(
            r"\b\d+\s*(s|sec|seconds?|ms|milliseconds?)\b", lower
        ):
            ambiguous_terms.append("unquantified response time")
            explanations.append("Response time or latency has no numerical threshold.")

        if re.search(r"\b(concurrent\s+users?|workload|traffic)\b", lower) and not re.search(
            r"\b\d+([,.\d]+)?\b", lower
        ):
            ambiguous_terms.append("unquantified user concurrency")
            explanations.append("User load has no concrete concurrent user count.")

        for sentence in re.split(r"(?<=[.!?])\s+", lower):
            if any(re.search(r"\b" + re.escape(attribute) + r"\b", sentence) for attribute in self.QUALITY_ATTRIBUTES):
                if not self.MEASUREMENT_PATTERN.search(sentence):
                    ambiguous_terms.append("non-measurable")
                    explanations.append("Quality attribute lacks a concrete number or unit in its sentence.")

        return {
            "is_ambiguous": bool(ambiguous_terms),
            "ambiguous_terms": ambiguous_terms,
            "ambiguity_explanation": " | ".join(explanations) if explanations else None,
            "severity": "danger" if len(ambiguous_terms) >= 2 else ("warning" if ambiguous_terms else "clean"),
        }

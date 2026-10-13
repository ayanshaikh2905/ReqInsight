import re
from typing import Dict, List

from backend.app.ml.ambiguity_service import AmbiguityService


class SmellService:
    """Detect standard requirement smells using the ambiguity measurements."""

    WEAK_MODALS = [
        (r"\b(can|could|may|might)\b", "Weak Modal", "Uses a permissive modal verb instead of a strict contractual modal."),
        (r"\b(if\s+possible|if\s+practical|where\s+feasible)\b", "Escape Clause", "Contains a subjective escape clause."),
        (r"\b(as\s+appropriate|as\s+needed|to\s+the\s+extent\s+possible)\b", "Unbounded Condition", "Contains an unbounded conditional statement."),
    ]
    SUBJECTIVE_TERMS = [r"\b(user[- ]friendly|intuitive|easy|simple|seamless|convenient|attractive|pleasing)\b"]
    NON_MEASURABLE_TERMS = [r"\b(fast\w*|quick\w*|efficient\w*|high[- ]performance|scalab\w*|reliab\w*|robust\w*)\b"]

    def detect_smells(
        self,
        text: str,
        is_ambiguous: bool = False,
        ambiguity_explanation: str = "",
        is_incomplete: bool = False,
        incompleteness_explanation: str = "",
    ) -> List[Dict[str, str]]:
        smells: List[Dict[str, str]] = []
        lower = text.lower()
        words = text.split()

        if is_ambiguous:
            smells.append({
                "smell": "Ambiguous / Vague",
                "description": ambiguity_explanation or "Contains ambiguous or vaguely quantified terminology.",
                "severity": "danger",
            })
        if is_incomplete:
            smells.append({
                "smell": "Incomplete Information",
                "description": incompleteness_explanation or "Lacks required structural elements.",
                "severity": "warning",
            })
        if any(re.search(pattern, lower) for pattern in self.SUBJECTIVE_TERMS):
            smells.append({
                "smell": "Subjective Language",
                "description": "Expresses subjective language rather than an objective specification.",
                "severity": "warning",
            })

        has_quality_attribute = any(
            re.search(r"\b" + re.escape(attribute) + r"\b", lower)
            for attribute in AmbiguityService.QUALITY_ATTRIBUTES
        )
        has_non_measurable_term = any(re.search(pattern, lower) for pattern in self.NON_MEASURABLE_TERMS)
        if (has_quality_attribute or has_non_measurable_term) and not AmbiguityService.MEASUREMENT_PATTERN.search(lower):
            smells.append({
                "smell": "Non-Measurable Constraint",
                "description": "Quality attribute lacks a verifiable number or unit.",
                "severity": "danger",
            })

        for pattern, smell_name, description in self.WEAK_MODALS:
            if re.search(pattern, lower):
                smells.append({"smell": smell_name, "description": description, "severity": "info"})
                break

        if len(words) > 35:
            smells.append({
                "smell": "Complex / Run-On Sentence",
                "description": f"Requirement is lengthy ({len(words)} words) and should be split.",
                "severity": "warning",
            })
        elif lower.count(" and ") >= 3 or " and/or " in lower:
            smells.append({
                "smell": "Compound Multi-Requirement",
                "description": "Contains multiple conjoined statements and may violate atomicity.",
                "severity": "warning",
            })

        return smells

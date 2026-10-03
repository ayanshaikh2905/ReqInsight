import re
from typing import List, Dict, Any


class SmellService:
    """
    Detects standard Requirement Smells (Femmer et al., IEEE TSE):
      1. Ambiguous phrasing
      2. Vague / Unquantified specifications
      3. Incomplete structure
      4. Subjective language
      5. Non-measurable constraints
      6. Weak / Optional modalities (escape clauses)
      7. Complex / Run-on sentences
    """

    WEAK_MODALS = [
        (r"\b(can|could|may|might)\b", "Weak Modal", "Uses permissive modal verb instead of strict contractual 'shall' or 'must'."),
        (r"\b(if\s+possible|if\s+practical|where\s+feasible)\b", "Escape Clause", "Contains subjective escape clause that weakens requirement bindingness."),
        (r"\b(as\s+appropriate|as\s+needed|to\s+the\s+extent\s+possible)\b", "Unbounded Condition", "Contains unbounded conditional statement.")
    ]

    SUBJECTIVE_TERMS = [
        r"\b(user[- ]friendly|intuitive|easy|simple|seamless|convenient|attractive|pleasing)\b"
    ]

    NON_MEASURABLE_TERMS = [
        r"\b(fast|quick|efficient|high[- ]performance|scalable|reliable|robust)\b"
    ]

    def detect_smells(
        self,
        text: str,
        is_ambiguous: bool = False,
        ambiguity_explanation: str = "",
        is_incomplete: bool = False,
        incompleteness_explanation: str = ""
    ) -> List[Dict[str, str]]:
        """
        Gathers all requirement smells with descriptive explanations and severity tags.
        """
        smells: List[Dict[str, str]] = []
        lower = text.lower()
        words = text.split()

        # 1. Ambiguity smell
        if is_ambiguous:
            smells.append({
                "smell": "Ambiguous / Vague",
                "description": ambiguity_explanation or "Contains ambiguous or vaguely quantified terminology.",
                "severity": "danger"
            })

        # 2. Incompleteness smell
        if is_incomplete:
            smells.append({
                "smell": "Incomplete Information",
                "description": incompleteness_explanation or "Lacks required structural elements (actor, trigger, or format).",
                "severity": "warning"
            })

        # 3. Subjective language smell
        if any(re.search(pat, lower) for pat in self.SUBJECTIVE_TERMS):
            smells.append({
                "smell": "Subjective Language",
                "description": "Expresses subjective user feelings rather than verifiable objective specifications.",
                "severity": "warning"
            })

        # 4. Non-measurable performance smell
        has_non_meas = any(re.search(pat, lower) for pat in self.NON_MEASURABLE_TERMS)
        has_numbers = bool(re.search(r"\b\d+([,\.]\d+)?\b", lower))
        if has_non_meas and not has_numbers:
            smells.append({
                "smell": "Non-Measurable Constraint",
                "description": "Quality attribute lacks verifiable engineering metrics (e.g. milliseconds, percentage, or volume).",
                "severity": "danger"
            })

        # 5. Weak modalities / Escape clauses
        for pat, smell_name, desc in self.WEAK_MODALS:
            if re.search(pat, lower):
                smells.append({
                    "smell": smell_name,
                    "description": desc,
                    "severity": "info"
                })
                break

        # 6. Sentence complexity / Run-on sentence smell
        if len(words) > 35:
            smells.append({
                "smell": "Complex / Run-On Sentence",
                "description": f"Requirement is lengthy ({len(words)} words) and should be split into atomic requirements.",
                "severity": "warning"
            })
        elif lower.count(" and ") >= 3 or " and/or " in lower:
            smells.append({
                "smell": "Compound Multi-Requirement",
                "description": "Contains multiple conjoined statements ('and/or'); violates requirement atomicity.",
                "severity": "warning"
            })

        return smells

import re
from typing import Dict, Any, List, Tuple


class AmbiguityService:
    """
    Hybrid Ambiguity Detection for Software Requirements Engineering.
    Analyzes lexical vagueness, missing measurable constraints,
    unquantified adjectives, and weak modalities.
    
    Academic principle: Labels findings as 'Potential Ambiguity' with
    explicit reasoning rather than absolute claims.
    """

    # Vague adjectives, adverbs, and subjective qualifiers
    VAGUE_TERMS = {
        "fast": "Response or execution time is unspecified (e.g., in milliseconds or seconds).",
        "quick": "Expected latency is subjective and lacks a measurable numerical threshold.",
        "slow": "Performance degradation boundary is not quantified.",
        "easy": "Usability criterion is subjective and not measured by task completion rate or SUS score.",
        "user-friendly": "Usability standard is unquantified without empirical usability metrics (e.g., ISO 9241).",
        "intuitive": "Interface expectation lacks concrete heuristic or user test specifications.",
        "large": "Quantitative capacity or threshold (e.g. bytes, count, or volume) is not defined.",
        "small": "Dimension or footprint scale is undefined.",
        "soon": "Temporal deadline or SLA duration is missing.",
        "efficient": "Efficiency metric (CPU usage, memory footprint, or algorithmic complexity) is unstated.",
        "secure": "Specific security standard, cipher suite (e.g. AES-256), or threat model is unspecified.",
        "appropriate": "Evaluation criteria for determining appropriateness are subjective and undefined.",
        "reasonable": "Acceptance threshold is subjective and open to divergent interpretation.",
        "optimal": "Objective function and optimization constraints are unspecified.",
        "robust": "Tolerance threshold for faults, exceptions, or load spikes is not articulated.",
        "flexible": "Scope and mechanism of flexibility/extensibility are not specified.",
        "seamless": "Integration or transition behavior is subjective without defined protocol.",
        "minimal": "Target minimum threshold or acceptable lower bound is not stated.",
        "maximum": None,  # Checked contextually for missing numeric bounds
        "adequate": "Criterion for adequacy is subjective without concrete capacity figures.",
        "sufficient": "Sufficiency criteria require explicit quantifiable parameters.",
        "etc": "Open-ended enumerations introduce scope creep and ambiguity.",
        "and/or": "Creates dual branching requirements with ambiguous verification paths.",
        "as needed": "Trigger conditions and boundaries for execution are undefined.",
        "if possible": "Weak contractual obligation; requirement lacks deterministic testability."
    }

    # Unquantified vague quantifiers
    VAGUE_QUANTIFIERS = [
        (r"\b(large\s+number\s+of)\b", "Vague quantifier 'large number of' without explicit concurrency or record limit."),
        (r"\b(several|various|many|few|numerous)\b", "Indefinite quantity without specific numerical bounds."),
        (r"\b(high\s+performance|high\s+availability)\b", "Subjective performance goal; requires 99.9% uptime or response time metric."),
        (r"\b(state[- ]of[- ]the[- ]art)\b", "Marketing terminology without engineering verification criteria."),
        (r"\b(as\s+soon\s+as\s+possible|asap)\b", "Indefinite timeline; specify precise SLA in seconds, hours, or days.")
    ]

    def detect_ambiguity(self, text: str) -> Dict[str, Any]:
        """
        Evaluates requirement for potential ambiguity, non-measurable terms,
        and subjective phrasing.
        """
        lower = text.lower()
        ambiguous_terms: List[str] = []
        explanations: List[str] = []

        # 1. Lexical checks for vague terms
        for term, explanation in self.VAGUE_TERMS.items():
            if explanation is None:
                continue
            pattern = r"\b" + re.escape(term) + r"\b"
            if re.search(pattern, lower):
                ambiguous_terms.append(term)
                explanations.append(f"Contains vague term '{term}': {explanation}")

        # 2. Check unquantified phrases
        for pattern, explanation in self.VAGUE_QUANTIFIERS:
            match = re.search(pattern, lower)
            if match:
                matched_str = match.group(0)
                if matched_str not in ambiguous_terms:
                    ambiguous_terms.append(matched_str)
                    explanations.append(explanation)

        # 3. Contextual missing measurement detection:
        # e.g., mentions 'respond' or 'response' without seconds/milliseconds
        if re.search(r"\b(respond|response\s+time|latency)\b", lower) and not re.search(r"\b(\d+)\s*(s|sec|seconds?|ms|milliseconds?)\b", lower):
            ambiguous_terms.append("unquantified response time")
            explanations.append("Mentions response time or latency without a quantifiable numerical threshold (e.g., '< 2 seconds').")

        # e.g., mentions 'concurrent users' or 'users' with 'large' or without a number
        if re.search(r"\b(concurrent\s+users?|workload|traffic)\b", lower) and not re.search(r"\b\d+([,\.]\d+)?\b", lower):
            ambiguous_terms.append("unquantified user concurrency")
            explanations.append("Specifies user load without a concrete concurrent user count (e.g., '10,000 concurrent users').")

        is_ambiguous = len(ambiguous_terms) > 0
        overall_explanation = " | ".join(explanations) if explanations else None

        return {
            "is_ambiguous": is_ambiguous,
            "ambiguous_terms": ambiguous_terms,
            "ambiguity_explanation": overall_explanation,
            "severity": "danger" if len(ambiguous_terms) >= 2 else ("warning" if is_ambiguous else "clean")
        }

from typing import Dict, Any, List
import re


class QualityScorer:
    """
    Transparent Academic Requirement Quality Scorer.
    
    CRITICAL ACADEMIC NOTICE:
    This is an empirical, project-defined composite quality index based on
    established software engineering principles (IEEE 830, ISO/IEC/IEEE 29148).
    It evaluates 6 orthogonal quality dimensions:
      1. Clarity (absence of vague, subjective lexical items)
      2. Completeness (presence of actor, action, object, and operational context)
      3. Specificity (presence of measurable criteria, units, and strict constraints)
      4. Consistency (absence of conflicting statements with other requirements)
      5. Testability (verifiability by test engineers with objective pass/fail criteria)
      6. Uniqueness (absence of near-duplicate redundancy within the specification)
    """

    def calculate_score(
        self,
        text: str,
        is_ambiguous: bool,
        ambiguous_terms: List[str],
        is_incomplete: bool,
        missing_elements: List[str],
        has_conflict: bool,
        has_duplicate: bool,
        similarity_max: float,
        req_type: str
    ) -> Dict[str, Any]:
        """
        Calculates individual sub-scores (0-100) and weighted overall composite score.
        """
        # 1. Clarity (Baseline: 95)
        clarity = 95
        if is_ambiguous:
            clarity -= min(55, len(ambiguous_terms) * 25)
        # Check weak modals
        lower = text.lower()
        if any(re.search(r"\b" + word + r"\b", lower) for word in ["can", "may", "could", "might"]):
            clarity -= 15
        if re.search(r"\band/or\b|\b\w+\s+/\s+\w+\b", lower):
            clarity -= 10
        clarity = max(10, min(100, clarity))

        # 2. Completeness (Baseline: 90)
        completeness = 90
        if is_incomplete:
            completeness -= min(60, len(missing_elements) * 20)
        word_count = len(text.split())
        if word_count < 7:
            completeness -= 25
        completeness = max(10, min(100, completeness))

        # 3. Specificity (Baseline: 85)
        specificity = 85
        has_numbers = any(char.isdigit() for char in text)
        if req_type == "Non-Functional" and not has_numbers:
            specificity -= 45  # Non-functional without numbers is heavily penalized
        if any(re.search(r"\b" + re.escape(v) + r"\b", lower) for v in ["fast", "quick", "easy", "large number", "several", "user-friendly"]):
            specificity -= 30
        if has_numbers:
            specificity = min(100, specificity + 15)
        specificity = max(10, min(100, specificity))

        # 4. Consistency (Baseline: 95)
        consistency = 95
        if has_conflict:
            consistency -= 60
        consistency = max(15, min(100, consistency))

        # 5. Testability (Baseline: 90)
        testability = 90
        if any(subj in lower for subj in ["user-friendly", "intuitive", "easy", "fast", "optimal", "seamless"]):
            testability -= 45
        if req_type == "Non-Functional" and not has_numbers:
            testability -= 35
        if is_incomplete:
            testability -= 15
        testability = max(10, min(100, testability))

        # 6. Uniqueness (Baseline: 95)
        uniqueness = 95
        if has_duplicate or similarity_max >= 0.85:
            penalty = max(20, int(max(0.0, similarity_max - 0.70) * 150))
            uniqueness -= min(65, penalty)
        elif similarity_max >= 0.75:
            uniqueness -= 20
        uniqueness = max(15, min(100, uniqueness))

        # Weighted composite score
        # Weights: Clarity: 20%, Completeness: 20%, Specificity: 20%, Consistency: 15%, Testability: 15%, Uniqueness: 10%
        overall = int(
            clarity * 0.20 +
            completeness * 0.20 +
            specificity * 0.20 +
            consistency * 0.15 +
            testability * 0.15 +
            uniqueness * 0.10
        )
        overall = max(10, min(100, overall))

        scores = {
            "clarity": clarity,
            "completeness": completeness,
            "specificity": specificity,
            "consistency": consistency,
            "testability": testability,
            "uniqueness": uniqueness
        }

        # Recommendations based on lowest dimensions
        recommendations = []
        if clarity < 65:
            recommendations.append("Replace vague qualifiers with precise, deterministic terminology.")
        if completeness < 65:
            recommendations.append("Specify executing agent, required trigger conditions, and exact output format.")
        if specificity < 60:
            recommendations.append("Incorporate quantifiable SLA bounds (e.g. latency in ms, user concurrency limit).")
        if consistency < 60:
            recommendations.append("Resolve contradictory parameter constraints with conflicting requirements.")
        if testability < 60:
            recommendations.append("Refactor into measurable acceptance criteria with deterministic verification.")
        if uniqueness < 60:
            recommendations.append("Merge with duplicate requirement or refine distinctive functional scope.")

        rec_str = " ".join(recommendations) if recommendations else "Requirement complies well with standard IEEE/ISO quality guidelines."

        return {
            "overall_score": overall,
            "scores": scores,
            "recommendation": rec_str
        }

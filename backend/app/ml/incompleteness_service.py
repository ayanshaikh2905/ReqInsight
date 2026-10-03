import re
from typing import Dict, Any, List


class IncompletenessService:
    """
    Incompleteness Detection for Requirements Engineering.
    Analyzes syntactic completeness according to the standard IEEE 830 / ISO 29148 model:
      - Primary Actor (Agent)
      - Action (Functional verb)
      - Direct Object / Target
      - Condition / Context / Trigger
      - Output / Format Specification
      - Measurable Constraints
    """

    def detect_incompleteness(self, text: str) -> Dict[str, Any]:
        """
        Inspects requirement sentence and flags missing structural attributes.
        """
        lower = text.lower().strip()
        missing_elements: List[str] = []
        reasons: List[str] = []

        # 1. Check for Actor / Subject
        has_explicit_actor = bool(re.search(
            r"\b(the\s+system|the\s+software|the\s+application|the\s+administrator|admin|users?|customers?|clients?|operator|cashier|manager)\b",
            lower
        ))
        # Passive voice without agent: e.g. "Reports shall be generated."
        is_passive_without_agent = bool(re.search(
            r"\b(shall|must|should|is|are)\s+be\s+([a-z]+ed)\b",
            lower
        )) and not bool(re.search(r"\bby\s+(the\s+)?([a-z]+)\b", lower))

        if not has_explicit_actor:
            missing_elements.append("Explicit Actor / Agent")
            reasons.append("Lacks an explicit executing agent (e.g. 'The system' or 'The administrator').")
        elif is_passive_without_agent:
            missing_elements.append("Executing Subject (Passive Voice)")
            reasons.append("Uses passive voice without defining who or what initiates the process.")

        # 2. Check for Target / Specificity on generic verbs
        # e.g., "The system shall generate reports." -> reports of what? format?
        if re.search(r"\b(generate\s+reports?|export\s+data|send\s+notifications?|process\s+payments?|store\s+information)\b", lower):
            # Check if format or destination is specified
            has_format_or_type = bool(re.search(r"\b(in\s+(pdf|csv|json|xml|excel)|via\s+(email|sms|webhook)|using\s+[a-z]+|containing\s+[a-z]+)\b", lower))
            if not has_format_or_type:
                missing_elements.append("Output Format & Destination")
                reasons.append("Does not specify the output format (e.g. PDF/CSV), delivery channel, or recipient.")

        # 3. Check for Conditional / Trigger clause in reactive actions
        # e.g. "reset password" or "send notification" without "when", "if", "upon", "after"
        reactive_verbs = [r"\b(reset\s+password|send\s+notification|lock\s+account|rollback|trigger\s+alert)\b"]
        if any(re.search(v, lower) for v in reactive_verbs):
            has_trigger = bool(re.search(r"\b(when|if|upon|after|in the event of|following)\b", lower))
            if not has_trigger:
                missing_elements.append("Trigger / Precondition")
                reasons.append("Reactive operation lacks explicit trigger condition (e.g. 'upon receiving password reset request').")

        # 4. Check for brevity / underspecification (sentences with <= 6 words often lack parameters)
        word_count = len(text.split())
        if word_count < 8 and not reasons:
            missing_elements.append("Operational Context")
            reasons.append("Statement is excessively brief and lacks contextual parameters or constraints.")

        is_incomplete = len(missing_elements) > 0
        overall_explanation = " ".join(reasons) if reasons else None

        return {
            "is_incomplete": is_incomplete,
            "missing_elements": missing_elements,
            "incompleteness_explanation": overall_explanation,
            "severity": "danger" if len(missing_elements) >= 2 else ("warning" if is_incomplete else "clean")
        }

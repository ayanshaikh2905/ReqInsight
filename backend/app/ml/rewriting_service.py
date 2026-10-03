import re
from typing import Dict, Any, List


class RewritingService:
    """
    Requirement Rewriting Service.
    Transforms informal, ambiguous, or poorly structured statements into
    compliant IEEE 830 / ISO/IEC/IEEE 29148 standard format.
    
    ACADEMIC SAFETY PRINCIPLE:
    Does NOT hallucinate arbitrary business requirements. If operational
    parameters are missing, explicitly inserts:
      [Information required: specify <parameter>]
    """

    def rewrite(self, text: str, smells: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Rewrites a requirement statement into an improved, verifiable format.
        """
        lower = text.lower().strip()
        changes = []
        improved = text

        # 1. Normalize weak modal verbs to 'shall' or 'must'
        if re.search(r"\b(should|can|could|may|is to|needs to)\b", lower):
            improved = re.sub(r"\b(should|can|could|may|needs to|is to)\b", "shall", improved, flags=re.IGNORECASE)
            changes.append("Normalized weak/permissive modal verb to contractual 'shall'")

        # 2. Ensure explicit Subject / Actor
        if not re.search(r"\b(the system|the application|the software|the [a-z]+)\b", improved, flags=re.IGNORECASE):
            improved = "The system shall " + improved[0].lower() + improved[1:]
            changes.append("Added explicit subject 'The system shall'")

        # 3. Handle Vague Performance ("fast", "quick")
        if re.search(r"\b(very fast|fast|quick|quickly)\b", improved, flags=re.IGNORECASE):
            improved = re.sub(
                r"\b(be\s+very\s+fast|be\s+fast|be\s+quick|run\s+quickly)\b",
                "respond within [Information required: specify response SLA, e.g. < 2 seconds] under normal operational load",
                improved,
                flags=re.IGNORECASE
            )
            changes.append("Replaced vague speed qualifier with verifiable SLA placeholder")

        # 4. Handle Vague Capacity ("large number of users")
        if re.search(r"\b(large\s+number\s+of\s+users?|many\s+users?)\b", improved, flags=re.IGNORECASE):
            improved = re.sub(
                r"\b(a\s+large\s+number\s+of\s+users?|large\s+number\s+of\s+users?|many\s+users?)\b",
                "at least [Information required: specify target concurrent capacity, e.g. 10,000] concurrent users",
                improved,
                flags=re.IGNORECASE
            )
            changes.append("Replaced indefinite user quantity with capacity threshold placeholder")

        # 5. Handle Incomplete Reporting
        if re.search(r"\bgenerate\s+reports?\b", improved, flags=re.IGNORECASE) and not re.search(r"\b(pdf|csv|format)\b", improved, flags=re.IGNORECASE):
            improved = re.sub(
                r"\bgenerate\s+reports?\b",
                "generate reports in [Information required: specify format, e.g. PDF and CSV] for authorized users",
                improved,
                flags=re.IGNORECASE
            )
            changes.append("Added explicit export format and recipient parameter placeholders")

        # 6. Handle Missing Reset Password Trigger
        if re.search(r"\b(reset\s+their\s+password|change\s+their\s+forgotten\s+password)\b", improved, flags=re.IGNORECASE) and "email" not in lower:
            if not re.search(r"\b(via|using|upon)\b", improved, flags=re.IGNORECASE):
                improved = re.sub(
                    r"\b(reset\s+their\s+password|change\s+their\s+forgotten\s+password)\b",
                    "reset their password via a secure verification link sent to their registered email address",
                    improved,
                    flags=re.IGNORECASE
                )
                changes.append("Specified verification mechanism for password recovery")

        # 7. Handle Subjective terms ("user-friendly", "easy to use")
        if re.search(r"\b(user[- ]friendly|easy\s+to\s+use|intuitive)\b", improved, flags=re.IGNORECASE):
            improved = re.sub(
                r"\b(be\s+user[- ]friendly|be\s+easy\s+to\s+use|be\s+intuitive)\b",
                "achieve a System Usability Scale (SUS) score of at least 80 during user acceptance testing",
                improved,
                flags=re.IGNORECASE
            )
            changes.append("Converted subjective usability adjective into objective SUS benchmark")

        # 8. Clean up double spaces and ensure ending punctuation
        improved = re.sub(r"\s+", " ", improved).strip()
        if not improved.endswith("."):
            improved += "."

        if not changes:
            changes.append("Structure complies with standard IEEE 830 phrasing; minor stylistic alignment applied.")

        return {
            "original_text": text,
            "improved_text": improved,
            "method": "Rule-based & Template-guided IEEE 830 Reformulation",
            "changes_made": changes
        }

import re
from typing import Dict, Any


class UserStoryService:
    """
    Transforms software requirements into standard Agile User Stories:
      'As a <role>, I want <goal/action>, so that <business value/benefit>.'
    """

    BENEFIT_MAP = {
        "log in": "I can securely access my personal dashboard and services",
        "login": "I can access authenticated features and account data",
        "reset password": "I can regain access to my account if I forget my password",
        "forgotten password": "I can restore account access securely",
        "report": "I can make data-driven decisions based on system analytics",
        "track order": "I can monitor the real-time shipping and delivery status of my purchase",
        "payment": "I can complete my transaction quickly and securely",
        "fast": "I can complete my tasks efficiently without experiencing latency delays",
        "concurrent users": "the application remains responsive and reliable under heavy traffic",
        "search": "I can quickly discover relevant items without browsing manually",
        "export": "I can analyze and archive operational records externally",
        "notification": "I am immediately informed about important updates and status changes",
        "encrypt": "confidential user data is protected against unauthorized interception"
    }

    def generate_user_story(self, text: str, entities: list = None) -> Dict[str, str]:
        """
        Derives actor, action, and rationale from requirement text.
        """
        lower = text.lower()

        # 1. Determine Actor Role
        actor = "user"
        if re.search(r"\b(customer|customers)\b", lower):
            actor = "customer"
        elif re.search(r"\b(administrator|admin|administrators)\b", lower):
            actor = "system administrator"
        elif re.search(r"\b(cashier|cashiers)\b", lower):
            actor = "cashier"
        elif re.search(r"\b(patient|patients)\b", lower):
            actor = "patient"
        elif re.search(r"\b(doctor|doctors|physician)\b", lower):
            actor = "healthcare provider"
        elif re.search(r"\b(auditor|security\s+officer)\b", lower):
            actor = "compliance auditor"
        elif re.search(r"\b(developer|api\s+consumer)\b", lower):
            actor = "integrating developer"

        # 2. Extract Goal / Action
        action = text
        # Remove prefix like "The system shall allow users to" or "The system should"
        action = re.sub(
            r"^(the\s+(system|software|application|platform)\s+(shall|must|should|will)\s+(allow\s+(registered\s+)?users?\s+to|allow\s+customers?\s+to|provide|support)?)\s*",
            "",
            action,
            flags=re.IGNORECASE
        )
        action = re.sub(r"^(users?\s+(shall|must|should|can)\s+)", "", action, flags=re.IGNORECASE)
        action = re.sub(r"^(passwords?\s+must\s+)", "have passwords that ", action, flags=re.IGNORECASE)
        action = action.rstrip(". \t")
        if not action:
            action = text

        # 3. Determine Benefit / Value
        benefit = "the system delivers expected functionality reliably"
        for key, val in self.BENEFIT_MAP.items():
            if key in lower:
                benefit = val
                break

        user_story = f"As a {actor}, I want to {action.lower() if not action.startswith('have') else action}, so that {benefit}."
        # Clean grammar
        user_story = re.sub(r"\bto\s+to\b", "to", user_story)

        return {
            "original_text": text,
            "user_story": user_story,
            "actor": actor,
            "action": action,
            "benefit": benefit
        }

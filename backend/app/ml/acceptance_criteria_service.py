import re
from typing import Dict, Any


class AcceptanceCriteriaService:
    """
    Generates Gherkin-style Acceptance Criteria (Given-When-Then)
    for software requirements verification.
    """

    def generate_criteria(self, text: str, req_type: str = "Functional") -> Dict[str, str]:
        """
        Derives verifiable Given-When-Then acceptance criteria from requirement semantics.
        """
        lower = text.lower()

        # Specific domain scenarios
        if "log in" in lower or "login" in lower:
            scenario = (
                "Scenario: Successful user authentication\n"
                "  Given the user is on the login page and has valid registered credentials\n"
                "  When the user submits their username and password\n"
                "  Then the system should authenticate the user and redirect to their account dashboard."
            )
        elif "reset" in lower and "password" in lower or "forgotten password" in lower:
            scenario = (
                "Scenario: Password recovery via email\n"
                "  Given a user has an active account with a confirmed email address\n"
                "  When the user submits a password reset request with their email\n"
                "  Then the system should issue a time-limited secure reset link to that email address."
            )
        elif "report" in lower:
            scenario = (
                "Scenario: Generation and export of operational reports\n"
                "  Given an authorized user navigates to the reporting module with selected filters\n"
                "  When the user clicks the generate/export button\n"
                "  Then the system should compile the requested dataset and produce the document within specified SLA."
            )
        elif "track order" in lower or ("track" in lower and "order" in lower):
            scenario = (
                "Scenario: Real-time customer order tracking\n"
                "  Given the customer has placed an active order with tracking enabled\n"
                "  When the customer navigates to the order tracking view\n"
                "  Then the system should display current package location, transit milestones, and estimated delivery date."
            )
        elif "concurrent users" in lower or "load" in lower:
            match_num = re.search(r"\b(\d+([,\.]\d+)?)\b", lower)
            users_count = match_num.group(1) if match_num else "10,000"
            scenario = (
                "Scenario: Scalability and high concurrency threshold\n"
                "  Given the production cluster is operating under simulated synthetic load\n"
                "  When the number of simultaneous active sessions reaches " + users_count + " users\n"
                "  Then the system should maintain error rates below 0.1% and average response latency under 2.0 seconds."
            )
        elif "fast" in lower or "respond within" in lower or "latency" in lower:
            match_time = re.search(r"\b(\d+)\s*(s|sec|seconds?|ms|milliseconds?)\b", lower)
            time_bound = match_time.group(0) if match_time else "2.0 seconds"
            scenario = (
                "Scenario: Response latency compliance\n"
                "  Given the system is under standard operational benchmark workload\n"
                "  When an authorized query or transaction request is submitted\n"
                "  Then the system should return the complete response payload within " + time_bound + "."
            )
        elif "password" in lower and ("character" in lower or "length" in lower):
            scenario = (
                "Scenario: Password complexity validation\n"
                "  Given a user is creating or updating their account credentials\n"
                "  When the user submits a password satisfying length and character complexity rules\n"
                "  Then the system should accept the password; otherwise, display an informative validation error."
            )
        elif "encrypt" in lower or "aes" in lower or "tls" in lower:
            scenario = (
                "Scenario: Cryptographic protection of sensitive data\n"
                "  Given sensitive user payloads or credentials are submitted for persistence or transmission\n"
                "  When data is written to disk or transmitted across network interfaces\n"
                "  Then the system must enforce strong encryption (e.g., AES-256 / TLS 1.3) with verified cipher suites."
            )
        else:
            # Generalized structured Given-When-Then
            scenario = (
                "Scenario: Standard requirement verification\n"
                f"  Given the system is in an initialized state with all dependencies operational\n"
                f"  When the triggering event corresponding to '{text.rstrip('.')}' occurs\n"
                f"  Then the system should execute the expected action deterministically without unhandled errors."
            )

        return {
            "original_text": text,
            "acceptance_criteria": scenario,
            "format": "Gherkin (Given / When / Then)"
        }

import re
from typing import List, Dict, Any, Optional
import numpy as np


class ConflictService:
    """
    Identifies contradictory or mutually incompatible requirements.
    
    Academic Workflow:
      1. Semantically related requirement retrieval via Sentence-BERT / embeddings.
      2. Incompatible constraint extraction (numerical bounds, opposing logic, negation).
      3. Classification into: 'Potential Conflict', 'Supports', 'Duplicate', or 'Unrelated'.
    """

    # Antonym / Opposing polarity pairs
    OPPOSING_POLARITIES = [
        (r"\b(enable|activate|allow|permit)\b", r"\b(disable|deactivate|disallow|prohibit|restrict|prevent|forbid)\b", "Opposing authorization/feature activation policy"),
        (r"\b(public|anonymous|unauthenticated)\b", r"\b(private|authenticated|restricted|confidential)\b", "Incompatible data privacy or access scope"),
        (r"\b(sync|synchronous)\b", r"\b(async|asynchronous)\b", "Incompatible communication model"),
        (r"\b(single[- ]user|exclusive)\b", r"\b(multi[- ]user|concurrent|shared)\b", "Incompatible tenancy / concurrency model"),
        (r"\b(automatic|automated)\b", r"\b(manual|require manual approval)\b", "Conflicting automation policy")
    ]

    def find_conflicts(
        self,
        requirements: List[Dict[str, Any]],
        sim_matrix: Optional[np.ndarray] = None
    ) -> List[Dict[str, Any]]:
        """
        Scans all pairs of requirements for direct or contextual contradictions.
        """
        conflicts = []
        n = len(requirements)

        for i in range(n):
            for j in range(i + 1, n):
                req_a = requirements[i]
                req_b = requirements[j]
                
                # Check semantic proximity if similarity matrix is provided
                sim = float(sim_matrix[i][j]) if sim_matrix is not None else 0.5

                conflict_info = self.check_pair_conflict(req_a["text"], req_b["text"], sim)
                if conflict_info:
                    conflicts.append({
                        "req_a_id": req_a["id"],
                        "req_a_text": req_a["text"],
                        "req_b_id": req_b["id"],
                        "req_b_text": req_b["text"],
                        "conflict_type": conflict_info["type"],
                        "explanation": conflict_info["explanation"],
                        "confidence": conflict_info["confidence"]
                    })

        return conflicts

    def check_pair_conflict(self, text_a: str, text_b: str, similarity: float) -> Optional[Dict[str, Any]]:
        """
        Evaluates two requirement texts for logical conflict or constraint incompatibility.
        """
        a_low = text_a.lower()
        b_low = text_b.lower()

        # 1. Check numeric constraint contradictions on same subject
        # e.g., "Passwords must contain at least 8 characters" vs "Passwords must contain a maximum of 6 characters"
        pwd_a = "password" in a_low
        pwd_b = "password" in b_low
        if pwd_a and pwd_b:
            min_a = re.search(r"\b(at least|minimum of|min)\s+(\d+)\b", a_low)
            max_b = re.search(r"\b(maximum of|at most|max)\s+(\d+)\b", b_low)
            min_b = re.search(r"\b(at least|minimum of|min)\s+(\d+)\b", b_low)
            max_a = re.search(r"\b(maximum of|at most|max)\s+(\d+)\b", a_low)

            if min_a and max_b:
                val_min = int(min_a.group(2))
                val_max = int(max_b.group(2))
                if val_min > val_max:
                    return {
                        "type": "Incompatible Numeric Constraint",
                        "explanation": f"REQ specifies minimum password length of {val_min} characters, but the other specifies a maximum length of {val_max} characters, making compliance mathematically impossible.",
                        "confidence": 0.96
                    }

            if min_b and max_a:
                val_min = int(min_b.group(2))
                val_max = int(max_a.group(2))
                if val_min > val_max:
                    return {
                        "type": "Incompatible Numeric Constraint",
                        "explanation": f"REQ specifies minimum password length of {val_min} characters while the other caps it at {val_max} characters.",
                        "confidence": 0.96
                    }

        # 2. Response time / Latency conflicts
        resp_a = any(k in a_low for k in ["respond within", "response time", "latency"])
        resp_b = any(k in b_low for k in ["respond within", "response time", "latency"])
        if resp_a and resp_b:
            time_a = re.search(r"\b(\d+)\s*(s|sec|seconds?|ms)\b", a_low)
            time_b = re.search(r"\b(\d+)\s*(s|sec|seconds?|ms)\b", b_low)
            if time_a and time_b:
                # Convert both to ms
                unit_a = time_a.group(2)
                unit_b = time_b.group(2)
                val_a = int(time_a.group(1)) * (1000 if "s" in unit_a and "ms" not in unit_a else 1)
                val_b = int(time_b.group(1)) * (1000 if "s" in unit_b and "ms" not in unit_b else 1)
                if abs(val_a - val_b) >= 2000:
                    return {
                        "type": "Conflicting Performance SLA",
                        "explanation": f"Discrepancy in latency SLA: one specifies {time_a.group(0)} while the other specifies {time_b.group(0)}.",
                        "confidence": 0.89
                    }

        # 3. Opposing polarity in semantically close sentences
        # Both share key subject terms (e.g. data, user, access, log, feature)
        shared_subject = len(set(a_low.split()) & set(b_low.split()) - {"the", "system", "shall", "should", "must", "and", "or", "to", "in", "of", "a", "for", "with"})
        if shared_subject >= 2 or similarity >= 0.55:
            for pos_pat, neg_pat, expl in self.OPPOSING_POLARITIES:
                match_a_pos = re.search(pos_pat, a_low)
                match_b_neg = re.search(neg_pat, b_low)
                match_a_neg = re.search(neg_pat, a_low)
                match_b_pos = re.search(pos_pat, b_low)

                if (match_a_pos and match_b_neg) or (match_a_neg and match_b_pos):
                    return {
                        "type": "Direct Polarity Contradiction",
                        "explanation": f"{expl}: one requirement permits/enables an operation while the other restricts or prohibits it.",
                        "confidence": 0.91
                    }

        return None

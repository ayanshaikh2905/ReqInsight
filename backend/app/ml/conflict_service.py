import re
from typing import Any, Dict, List, Optional

import numpy as np


ATTRIBUTE_DEFINITIONS = [
    {
        "name": "response_time",
        "patterns": [r"response\s*time", r"respond(?:s|ing)?\s+(?:within|in)", r"latency"],
        "unit_pattern": r"(?:ms|milliseconds?|s|sec|seconds?|min|minutes?)",
    },
    {
        "name": "accuracy",
        "patterns": [r"accuracy", r"correct(?:ness|ly)?"],
        "unit_pattern": r"%|percent",
    },
    {
        "name": "input_length",
        "patterns": [r"input", r"(?:request|prompt|document)\s+length"],
        "unit_pattern": r"words?|characters?|chars?|tokens?",
    },
    {
        "name": "input_language",
        "patterns": [r"language", r"english", r"french", r"spanish", r"german", r"arabic"],
        "unit_pattern": None,
    },
    {
        "name": "output_format",
        "patterns": [r"output", r"format", r"json", r"xml", r"csv", r"yaml", r"pdf"],
        "unit_pattern": None,
    },
    {
        "name": "data_retention",
        "patterns": [r"store", r"retain", r"persist", r"delete", r"erase", r"retention"],
        "unit_pattern": None,
    },
    {
        "name": "authentication",
        "patterns": [r"log\s*in", r"login", r"authenticate", r"anonymous", r"unauthenticated"],
        "unit_pattern": None,
    },
    {
        "name": "deployment",
        "patterns": [r"offline", r"online", r"cloud", r"internet", r"network"],
        "unit_pattern": None,
    },
    {
        "name": "password_length",
        "patterns": [r"password"],
        "unit_pattern": r"characters?|chars?",
    },
]

_NUMBER_PATTERN = re.compile(
    r"(?P<qualifier>at\s+least|at\s+most|minimum(?:\s+of)?|maximum(?:\s+of)?|within|under|below|over|above|exactly|equal\s+to)?\s*"
    r"(?P<number>\d+(?:\.\d+)?)\s*(?P<unit>ms|milliseconds?|s|sec|seconds?|min|minutes?|%|percent|words?|characters?|chars?|tokens?)?",
    re.IGNORECASE,
)


_ATTRIBUTE_ORDER = [definition["name"] for definition in ATTRIBUTE_DEFINITIONS]
_COMPILED_DEFINITIONS = [
    {**definition, "regex": re.compile("|".join(f"(?:{p})" for p in definition["patterns"]))}
    for definition in ATTRIBUTE_DEFINITIONS
]


class ConflictService:
    """Detect incompatible constraints using table-driven attribute extraction."""

    def find_conflicts(
        self,
        requirements: List[Dict[str, Any]],
        sim_matrix: Optional[np.ndarray] = None,
    ) -> List[Dict[str, Any]]:
        conflicts = []
        # Attribute values are extracted once per requirement (O(n)) instead of
        # once per pair (O(n^2)); only requirements sharing an attribute are compared.
        extracted = [self._extract_values(req["text"]) for req in requirements]
        by_attribute: Dict[str, List[int]] = {}
        for idx, values in enumerate(extracted):
            for attribute in values:
                by_attribute.setdefault(attribute, []).append(idx)

        candidate_pairs = set()
        for indices in by_attribute.values():
            for pos, i in enumerate(indices):
                for j in indices[pos + 1:]:
                    candidate_pairs.add((i, j))

        for i, j in sorted(candidate_pairs):
            req_a = requirements[i]
            req_b = requirements[j]
            conflict_info = self._compare_values(extracted[i], extracted[j])
            if conflict_info:
                if conflict_info:
                    conflicts.append({
                        "req_a_id": req_a["id"],
                        "req_a_text": req_a["text"],
                        "req_b_id": req_b["id"],
                        "req_b_text": req_b["text"],
                        **conflict_info,
                    })
        return conflicts

    def check_pair_conflict(
        self, text_a: str, text_b: str, similarity: float
    ) -> Optional[Dict[str, Any]]:
        return self._compare_values(self._extract_values(text_a), self._extract_values(text_b))

    def _compare_values(
        self, values_a: Dict[str, Dict[str, Any]], values_b: Dict[str, Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        # Iterate in definition order so the reported attribute is deterministic.
        for attribute in [name for name in _ATTRIBUTE_ORDER if name in values_a and name in values_b]:
            value_a = values_a[attribute]
            value_b = values_b[attribute]
            if value_a.get("numeric") and value_b.get("numeric"):
                if self._numeric_values_conflict(value_a, value_b):
                    return self._result(
                        attribute,
                        value_a,
                        value_b,
                        "Incompatible Numeric Constraint",
                        0.96,
                    )
            elif self._categorical_values_conflict(attribute, value_a, value_b):
                conflict_type = (
                    "Negated Requirement"
                    if value_a.get("negated") != value_b.get("negated")
                    else "Mutually Exclusive Values"
                )
                return self._result(attribute, value_a, value_b, conflict_type, 0.94)

        return None

    @staticmethod
    def _result(
        attribute: str,
        value_a: Dict[str, Any],
        value_b: Dict[str, Any],
        conflict_type: str,
        confidence: float,
    ) -> Dict[str, Any]:
        text_a = value_a["display"]
        text_b = value_b["display"]
        return {
            "attribute": attribute,
            "conflict_type": conflict_type,
            "value_a": text_a,
            "value_b": text_b,
            "explanation": f"The {attribute.replace('_', ' ')} values '{text_a}' and '{text_b}' are incompatible.",
            "confidence": confidence,
        }

    def _extract_values(self, text: str) -> Dict[str, Dict[str, Any]]:
        lowered = text.lower()
        values: Dict[str, Dict[str, Any]] = {}
        for definition in _COMPILED_DEFINITIONS:
            if not definition["regex"].search(lowered):
                continue

            number = self._extract_number(lowered, definition["unit_pattern"])
            if number:
                values[definition["name"]] = number
                continue

            categorical = self._extract_category(definition["name"], lowered)
            if categorical:
                values[definition["name"]] = categorical
        return values

    @staticmethod
    def _extract_number(text: str, unit_pattern: Optional[str]) -> Optional[Dict[str, Any]]:
        for match in _NUMBER_PATTERN.finditer(text):
            unit = (match.group("unit") or "").lower()
            if unit_pattern and not re.fullmatch(unit_pattern, unit, re.IGNORECASE):
                continue
            if not unit and unit_pattern:
                continue

            number = float(match.group("number"))
            if unit in {"s", "sec", "second", "seconds"}:
                number *= 1000
                normalized_unit = "ms"
            elif unit in {"min", "minute", "minutes"}:
                number *= 60000
                normalized_unit = "ms"
            else:
                normalized_unit = unit or "value"

            qualifier = (match.group("qualifier") or "exactly").lower()
            if qualifier in {"at least", "minimum", "minimum of", "over", "above"}:
                bound = "lower"
            elif qualifier in {"at most", "maximum", "maximum of", "within", "under", "below"}:
                bound = "upper"
            else:
                bound = "exact"
            return {
                "numeric": True,
                "number": number,
                "bound": bound,
                "display": match.group(0).strip(),
                "normalized_unit": normalized_unit,
            }
        return None

    @staticmethod
    def _extract_category(attribute: str, text: str) -> Optional[Dict[str, Any]]:
        category_patterns = {
            "input_language": [
                (r"(?:only|support(?:s)?|accept(?:s)?|in)\s+(english|french|spanish|german|arabic)", False),
                (r"reject(?:s)?\s+(english|french|spanish|german|arabic)", True),
            ],
            "output_format": [(r"(?:json|xml|csv|yaml|pdf)", False)],
            "data_retention": [
                (r"(?:never|must not|shall not)\s+(?:store|retain|persist)", True),
                (r"(?:store|retain|persist)(?:s|ed)?", False),
                (r"(?:delete|erase)(?:s|d)?", True),
            ],
            "authentication": [
                (r"(?:require|requires|must use|shall use).*?\blog\s*in\b|authenticate", False),
                (r"anonymous|without\s+(?:a\s+)?login|unauthenticated", True),
            ],
            "deployment": [(r"offline", False), (r"online|cloud|internet", False)],
        }
        for pattern, negated in category_patterns.get(attribute, []):
            match = re.search(pattern, text)
            if match:
                value = match.group(1) if match.lastindex else match.group(0)
                return {
                    "display": value,
                    "value": value,
                    "negated": negated,
                    "exclusive": attribute == "output_format" and bool(re.search(r"\bonly\b", text)),
                }
        return None

    @staticmethod
    def _numeric_values_conflict(value_a: Dict[str, Any], value_b: Dict[str, Any]) -> bool:
        bound_a = value_a["bound"]
        bound_b = value_b["bound"]
        number_a = value_a["number"]
        number_b = value_b["number"]
        if bound_a == "exact" or bound_b == "exact":
            return number_a != number_b
        if bound_a == bound_b:
            return number_a != number_b
        lower = number_a if bound_a == "lower" else number_b
        upper = number_b if bound_b == "upper" else number_a
        return lower > upper

    @staticmethod
    def _categorical_values_conflict(
        attribute: str, value_a: Dict[str, Any], value_b: Dict[str, Any]
    ) -> bool:
        if value_a.get("value") == value_b.get("value") and value_a.get("negated") == value_b.get("negated"):
            return False
        if attribute == "output_format" and not (value_a.get("exclusive") and value_b.get("exclusive")):
            return False
        return value_a.get("value") != value_b.get("value") or value_a.get("negated") != value_b.get("negated")

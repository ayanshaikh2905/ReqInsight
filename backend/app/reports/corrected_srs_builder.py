import re
from collections import defaultdict
from typing import Any, Dict, List, Set


PLACEHOLDER_PATTERN = re.compile(r"\[Information required:[^\]]+\]")


class CorrectedSRSBuilder:
    """Builds a corrected SRS representation from an existing analysis."""

    def build(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        analysis = analysis or {}
        requirements = list(analysis.get("requirements", []))
        requirements_by_id = {str(req.get("id")): req for req in requirements}
        conflict_pairs = list(analysis.get("conflicts", []))
        conflict_ids: Set[str] = set()
        for pair in conflict_pairs:
            conflict_ids.update((str(pair.get("req_a_id")), str(pair.get("req_b_id"))))

        duplicate_pairs = [
            pair for pair in analysis.get("duplicates", [])
            if str(pair.get("req_a_id")) not in conflict_ids
            and str(pair.get("req_b_id")) not in conflict_ids
        ]
        removed_ids, kept_for_removed, edge_for_removed = self._resolve_duplicates(
            duplicate_pairs, requirements_by_id
        )

        changelog: List[Dict[str, str]] = []
        needs_decision = self._build_conflicts(conflict_pairs, requirements_by_id, changelog)
        merged_duplicates = []
        for removed_id in sorted(removed_ids, key=self._requirement_sort_key(requirements_by_id)):
            removed = requirements_by_id.get(removed_id, {})
            kept_id = kept_for_removed[removed_id]
            kept = requirements_by_id.get(kept_id, {})
            pair = edge_for_removed[removed_id]
            kept_text = self._base_text(kept)
            removed_text = self._base_text(removed)
            merged_duplicates.append({
                "kept_id": kept_id,
                "removed_id": removed_id,
                "similarity": pair.get("similarity", 0),
                "kept_text": kept_text,
                "removed_text": removed_text,
            })
            changelog.append({
                "req_id": removed_id,
                "change_type": "merged",
                "before": removed_text,
                "after": kept_text,
                "reason": "Merged as a duplicate of the higher-quality requirement.",
            })

        sections = []
        section_map = {}
        open_items = []
        summary = {
            "total": len(requirements),
            "unchanged": 0,
            "reworded": 0,
            "merged": len(removed_ids),
            "needs_decision": len(conflict_ids),
            "open_items": 0,
        }
        for req in sorted(requirements, key=lambda item: (item.get("line_number") is None,
                                                           item.get("line_number") or 0,
                                                           str(item.get("id", "")))):
            req_id = str(req.get("id", ""))
            if req_id in removed_ids:
                continue
            original_text = req.get("original_text") or req.get("text", "")
            base_text = self._base_text(req)
            corrected_text = base_text
            status = "unchanged"
            if req_id in conflict_ids:
                corrected_text = original_text
                status = "needs_decision"
            elif req.get("improved_text") and req.get("improved_text") != req.get("text"):
                corrected_text = req.get("improved_text")
                status = "reworded"

            notes = self._notes(req)
            section_title = req.get("section") or "General Requirements"
            if section_title not in section_map:
                section_map[section_title] = {"title": section_title, "requirements": []}
                sections.append(section_map[section_title])
            section_map[section_title]["requirements"].append({
                "id": req_id,
                "original_text": original_text,
                "corrected_text": corrected_text,
                "status": status,
                "notes": notes,
            })
            summary[status if status in ("unchanged", "reworded") else "needs_decision"] += 1

            for placeholder in PLACEHOLDER_PATTERN.findall(corrected_text):
                open_items.append({"req_id": req_id, "placeholder": placeholder})
        summary["open_items"] = len(open_items)

        for req in requirements:
            req_id = str(req.get("id", ""))
            if req_id in removed_ids or req_id in conflict_ids:
                continue
            if req.get("improved_text") and req.get("improved_text") != req.get("text"):
                before = self._base_text(req)
                after = req.get("improved_text")
                changelog.append({
                    "req_id": req_id,
                    "change_type": "reworded",
                    "before": before,
                    "after": after,
                    "reason": self._notes(req) or "Reworded using the analysis recommendation.",
                })

        return {
            "document_name": analysis.get("document_name", "SRS Document"),
            "sections": sections,
            "needs_decision": needs_decision,
            "merged_duplicates": merged_duplicates,
            "open_items": open_items,
            "changelog": changelog,
            "summary": summary,
        }

    @staticmethod
    def _base_text(req: Dict[str, Any]) -> str:
        return req.get("text") or req.get("original_text") or ""

    @staticmethod
    def _notes(req: Dict[str, Any]) -> str:
        recommendation = req.get("recommendation") or ""
        ambiguity = req.get("ambiguity_explanation") or ""
        incomplete = req.get("incompleteness_explanation") or ""
        missing = req.get("missing_elements") or []
        return recommendation or ambiguity or incomplete or (", ".join(missing) if missing else "")

    @staticmethod
    def _requirement_sort_key(requirements_by_id):
        def key(req_id):
            req = requirements_by_id.get(req_id, {})
            return (req.get("line_number") is None, req.get("line_number") or 0, req_id)
        return key

    def _resolve_duplicates(self, pairs, requirements_by_id):
        graph = defaultdict(list)
        for pair in pairs:
            a = str(pair.get("req_a_id"))
            b = str(pair.get("req_b_id"))
            if a in requirements_by_id and b in requirements_by_id and a != b:
                graph[a].append((b, pair))
                graph[b].append((a, pair))

        removed_ids = set()
        kept_for_removed = {}
        edge_for_removed = {}
        visited = set()
        for start in graph:
            if start in visited:
                continue
            component = []
            stack = [start]
            visited.add(start)
            while stack:
                current = stack.pop()
                component.append(current)
                for neighbor, _ in graph[current]:
                    if neighbor not in visited:
                        visited.add(neighbor)
                        stack.append(neighbor)
            kept = min(component, key=lambda req_id: (
                -float(requirements_by_id[req_id].get("quality_score", 0)), req_id
            ))
            for req_id in component:
                if req_id == kept:
                    continue
                removed_ids.add(req_id)
                kept_for_removed[req_id] = kept
                candidates = [pair for neighbor, pair in graph[req_id] if neighbor in component]
                edge_for_removed[req_id] = max(
                    candidates, key=lambda pair: float(pair.get("similarity", 0)), default={}
                )
        return removed_ids, kept_for_removed, edge_for_removed

    @staticmethod
    def _build_conflicts(conflict_pairs, requirements_by_id, changelog):
        result = []
        seen = set()
        for pair in conflict_pairs:
            a = str(pair.get("req_a_id"))
            b = str(pair.get("req_b_id"))
            key = frozenset((a, b))
            if key in seen:
                continue
            seen.add(key)
            req_a = requirements_by_id.get(a, {})
            req_b = requirements_by_id.get(b, {})
            text_a = req_a.get("original_text") or pair.get("req_a_text") or req_a.get("text", "")
            text_b = req_b.get("original_text") or pair.get("req_b_text") or req_b.get("text", "")
            result.append({
                "req_a_id": a,
                "req_a_text": text_a,
                "req_b_id": b,
                "req_b_text": text_b,
                "conflict_type": pair.get("conflict_type", "Conflict"),
                "explanation": pair.get("explanation", ""),
            })
            reason = pair.get("explanation") or "Conflicting requirements require a stakeholder decision."
            for req_id, text in ((a, text_a), (b, text_b)):
                changelog.append({
                    "req_id": req_id,
                    "change_type": "needs_decision",
                    "before": text,
                    "after": text,
                    "reason": reason,
                })
        return result
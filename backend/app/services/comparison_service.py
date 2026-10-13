"""Run-to-run comparison of two SRS analyses.

Requirements are matched across runs even when they were renumbered or reworded:
  1. identical (normalised) text,
  2. same ID with reasonably similar text,
  3. best lexical match above ``MATCH_THRESHOLD`` (greedy, highest similarity first).
Unmatched base requirements are "removed"; unmatched target requirements are "added".
"""
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

from backend.app.ml.similarity_service import SimilarityService

SUMMARY_FIELDS = [
    "total_requirements",
    "average_quality_score",
    "ambiguous_count",
    "incomplete_count",
    "duplicate_pairs_count",
    "conflict_pairs_count",
]
# Requirement count changing is neither good nor bad on its own.
NEUTRAL_FIELDS = {"total_requirements"}
# For these summary fields a decrease is an improvement.
LOWER_IS_BETTER = {"ambiguous_count", "incomplete_count", "duplicate_pairs_count", "conflict_pairs_count"}


class ComparisonService:
    MATCH_THRESHOLD = 0.55
    SAME_ID_THRESHOLD = 0.2
    SCORE_TOLERANCE = 1  # quality-score changes within ±1 count as unchanged

    def __init__(self, similarity: Optional[SimilarityService] = None):
        # Matching always uses the deterministic lexical encoder so results do not
        # depend on whether Sentence-BERT is installed.
        self.similarity = similarity or SimilarityService()

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _norm(text: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).strip()

    @staticmethod
    def issues_of(req: Dict[str, Any]) -> Set[str]:
        """Flattens a requirement's findings into comparable issue labels."""
        issues: Set[str] = {s.get("smell") for s in req.get("smells", []) if s.get("smell")}
        # The ambiguity/incompleteness flags usually surface as smells already;
        # only add them when no smell covers them, to avoid double counting.
        if req.get("is_ambiguous") and "Ambiguous / Vague" not in issues:
            issues.add("Ambiguous / Vague")
        if req.get("is_incomplete") and "Incomplete Information" not in issues:
            issues.add("Incomplete Information")
        if req.get("potential_conflicts"):
            issues.add("Conflict")
        if any(ref.get("is_duplicate") for ref in req.get("similar_requirements", [])):
            issues.add("Duplicate")
        return issues

    def _lexical_similarity(self, base_texts: List[str], target_texts: List[str]) -> np.ndarray:
        if not base_texts or not target_texts:
            return np.zeros((len(base_texts), len(target_texts)))
        vectors = self.similarity._encode_lexical(base_texts + target_texts)
        base_vecs = vectors[: len(base_texts)]
        target_vecs = vectors[len(base_texts):]
        return np.clip(base_vecs @ target_vecs.T, 0.0, 1.0)

    def match_requirements(
        self, base_reqs: List[Dict[str, Any]], target_reqs: List[Dict[str, Any]]
    ) -> List[Tuple[int, int, float]]:
        """Returns (base_index, target_index, similarity) pairs."""
        sim = self._lexical_similarity(
            [r.get("text", "") for r in base_reqs], [r.get("text", "") for r in target_reqs]
        )
        matches: List[Tuple[int, int, float]] = []
        used_base: Set[int] = set()
        used_target: Set[int] = set()

        def take(i: int, j: int, score: float) -> None:
            matches.append((i, j, score))
            used_base.add(i)
            used_target.add(j)

        # 1. Identical text
        target_by_text: Dict[str, List[int]] = {}
        for j, req in enumerate(target_reqs):
            target_by_text.setdefault(self._norm(req.get("text", "")), []).append(j)
        for i, req in enumerate(base_reqs):
            for j in target_by_text.get(self._norm(req.get("text", "")), []):
                if j not in used_target:
                    take(i, j, 1.0)
                    break

        # 2. Same ID, text still recognisably the same requirement
        target_by_id = {req.get("id"): j for j, req in enumerate(target_reqs)}
        for i, req in enumerate(base_reqs):
            if i in used_base:
                continue
            j = target_by_id.get(req.get("id"))
            if j is not None and j not in used_target and sim[i, j] >= self.SAME_ID_THRESHOLD:
                take(i, j, float(sim[i, j]))

        # 3. Greedy best lexical match
        if sim.size:
            order = np.dstack(np.unravel_index(np.argsort(-sim, axis=None), sim.shape))[0]
            for i, j in order:
                score = float(sim[i, j])
                if score < self.MATCH_THRESHOLD:
                    break
                if i in used_base or j in used_target:
                    continue
                take(int(i), int(j), score)

        matches.sort(key=lambda m: m[1])
        return matches

    @staticmethod
    def _run_header(run: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "run_id": run.get("run_id"),
            "document_name": run.get("document_name"),
            "created_at": run.get("created_at"),
            "summary": {k: run.get("summary", {}).get(k) for k in SUMMARY_FIELDS},
        }

    @staticmethod
    def _brief(req: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "id": req.get("id"),
            "text": req.get("text"),
            "quality_score": req.get("quality_score"),
            "issues": sorted(ComparisonService.issues_of(req)),
        }

    # ------------------------------------------------------------------ compare
    def compare(self, base: Dict[str, Any], target: Dict[str, Any]) -> Dict[str, Any]:
        base_reqs = base.get("requirements", [])
        target_reqs = target.get("requirements", [])
        matches = self.match_requirements(base_reqs, target_reqs)
        matched_base = {i for i, _, _ in matches}
        matched_target = {j for _, j, _ in matches}

        changed, unchanged = [], 0
        resolved_total = introduced_total = 0
        improved = regressed = 0
        for i, j, score in matches:
            a, b = base_reqs[i], target_reqs[j]
            issues_a, issues_b = self.issues_of(a), self.issues_of(b)
            resolved = sorted(issues_a - issues_b)
            introduced = sorted(issues_b - issues_a)
            resolved_total += len(resolved)
            introduced_total += len(introduced)
            delta = int(b.get("quality_score", 0)) - int(a.get("quality_score", 0))
            text_changed = self._norm(a.get("text", "")) != self._norm(b.get("text", ""))
            if delta > self.SCORE_TOLERANCE:
                improved += 1
            elif delta < -self.SCORE_TOLERANCE:
                regressed += 1
            if not text_changed and not resolved and not introduced and abs(delta) <= self.SCORE_TOLERANCE:
                unchanged += 1
                continue
            changed.append({
                "base_id": a.get("id"),
                "target_id": b.get("id"),
                "base_text": a.get("text"),
                "target_text": b.get("text"),
                "text_changed": text_changed,
                "match_similarity": round(score, 3),
                "base_score": a.get("quality_score"),
                "target_score": b.get("quality_score"),
                "score_delta": delta,
                "resolved_issues": resolved,
                "new_issues": introduced,
            })
        changed.sort(key=lambda c: (-abs(c["score_delta"]), c["target_id"] or ""))

        added = [self._brief(target_reqs[j]) for j in range(len(target_reqs)) if j not in matched_target]
        removed = [self._brief(base_reqs[i]) for i in range(len(base_reqs)) if i not in matched_base]
        introduced_total += sum(len(r["issues"]) for r in added)
        resolved_total += sum(len(r["issues"]) for r in removed)

        conflicts = self._compare_conflicts(base, target, matches)

        summary_delta = {}
        for field in SUMMARY_FIELDS:
            before = base.get("summary", {}).get(field) or 0
            after = target.get("summary", {}).get(field) or 0
            diff = round(after - before, 1)
            better = diff < 0 if field in LOWER_IS_BETTER else diff > 0
            if diff == 0:
                direction = "same"
            elif field in NEUTRAL_FIELDS:
                direction = "neutral"
            else:
                direction = "better" if better else "worse"
            summary_delta[field] = {"before": before, "after": after, "delta": diff, "direction": direction}

        score_delta = summary_delta["average_quality_score"]["delta"]
        net_issues = resolved_total - introduced_total
        if score_delta > 0.5 or (score_delta >= 0 and net_issues > 0):
            verdict = "improved"
        elif score_delta < -0.5 or (score_delta <= 0 and net_issues < 0):
            verdict = "regressed"
        else:
            verdict = "unchanged"

        return {
            "base": self._run_header(base),
            "target": self._run_header(target),
            "verdict": verdict,
            "summary_delta": summary_delta,
            "issues": {"resolved": resolved_total, "introduced": introduced_total},
            "requirements": {
                "matched": len(matches),
                "unchanged": unchanged,
                "improved": improved,
                "regressed": regressed,
                "changed": changed,
                "added": added,
                "removed": removed,
            },
            "conflicts": conflicts,
        }

    @staticmethod
    def _compare_conflicts(
        base: Dict[str, Any], target: Dict[str, Any], matches: List[Tuple[int, int, float]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        base_reqs = base.get("requirements", [])
        target_reqs = target.get("requirements", [])
        base_to_target = {base_reqs[i]["id"]: target_reqs[j]["id"] for i, j, _ in matches}
        target_pairs = {
            frozenset((c["req_a_id"], c["req_b_id"])): c for c in target.get("conflicts", [])
        }

        def view(c: Dict[str, Any]) -> Dict[str, Any]:
            return {
                "req_a_id": c["req_a_id"],
                "req_b_id": c["req_b_id"],
                "req_a_text": c.get("req_a_text"),
                "req_b_text": c.get("req_b_text"),
                "conflict_type": c.get("conflict_type"),
                "attribute": c.get("attribute"),
            }

        resolved, persisting_keys = [], set()
        for c in base.get("conflicts", []):
            a = base_to_target.get(c["req_a_id"])
            b = base_to_target.get(c["req_b_id"])
            key = frozenset((a, b)) if a and b else None
            if key is not None and key in target_pairs:
                persisting_keys.add(key)
            else:
                resolved.append(view(c))

        introduced = [view(c) for key, c in target_pairs.items() if key not in persisting_keys]
        persisting = [view(target_pairs[k]) for k in persisting_keys]
        return {"resolved": resolved, "introduced": introduced, "persisting": persisting}

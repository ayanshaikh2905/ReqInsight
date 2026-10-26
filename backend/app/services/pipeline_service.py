import uuid
from typing import List, Dict, Any, Optional
import numpy as np

from backend.app.services.extractor_service import ExtractorService
from backend.app.ml.classification_service import ClassificationService
from backend.app.ml.similarity_service import SimilarityService
from backend.app.ml.ambiguity_service import AmbiguityService
from backend.app.ml.incompleteness_service import IncompletenessService
from backend.app.ml.smell_service import SmellService
from backend.app.ml.conflict_service import ConflictService
from backend.app.ml.topic_service import TopicService
from backend.app.ml.ner_service import NERService
from backend.app.ml.quality_scorer import QualityScorer
from backend.app.services.llm_service import LLMService


class AnalysisPipeline:
    """
    Master NLP & Large Language Model Pipeline for ReqInsight AI.
    Executes end-to-end analysis on raw SRS text or pre-extracted requirements.
    """

    def __init__(self):
        self.extractor = ExtractorService()
        self.classifier = ClassificationService()
        self.similarity = SimilarityService()
        self.ambiguity = AmbiguityService()
        self.incompleteness = IncompletenessService()
        self.smells = SmellService()
        self.conflicts = ConflictService()
        self.topics = TopicService()
        self.ner = NERService()
        self.scorer = QualityScorer()
        self.llm = LLMService()
        # Similarity matrix of the most recent run, so duplicate thresholds can be
        # re-applied later without re-encoding the whole document.
        self.last_similarity: Optional[Dict[str, Any]] = None

    def run_pipeline(
        self,
        raw_text: str,
        document_name: str = "SRS Document",
        similarity_threshold: float = 0.85
    ) -> Dict[str, Any]:
        """
        Executes all 16 analytical pipeline stages.
        """
        # 1. Requirement Extraction
        raw_requirements = self.extractor.extract_requirements(raw_text)
        if not raw_requirements:
            raise ValueError("No requirement statements could be extracted from the document.")

        n = len(raw_requirements)
        req_texts = [r["text"] for r in raw_requirements]

        # 2. Dense Semantic Embeddings (Sentence-BERT)
        embeddings = self.similarity.encode(req_texts)
        sim_matrix = self.similarity.compute_similarity_matrix(embeddings)

        # 3. Duplicate Detection
        duplicates = self.similarity.find_duplicates(
            raw_requirements,
            threshold=similarity_threshold,
            sim_matrix=sim_matrix,
        )

        # 4. Conflict Detection
        conflict_list = self.conflicts.find_conflicts(raw_requirements, sim_matrix)
        conflict_pairs = {
            frozenset((c["req_a_id"], c["req_b_id"])) for c in conflict_list
        }
        duplicates = [
            d for d in duplicates
            if frozenset((d["req_a_id"], d["req_b_id"])) not in conflict_pairs
        ]
        dup_ids = {req_id for d in duplicates for req_id in (d["req_a_id"], d["req_b_id"])}
        conflict_ids = set()
        for c in conflict_list:
            conflict_ids.add(c["req_a_id"])
            conflict_ids.add(c["req_b_id"])

        # 5. Dynamic Topic Discovery
        topic_info_list = self.topics.discover_topics(raw_requirements, embeddings)

        # Batched stages: spaCy parses all requirements in one pipe, LLM calls run concurrently.
        entities_per_req = self.ner.extract_entities_batch(req_texts)
        enhanced_per_req = self.llm.enhance_requirements(req_texts)

        # Highest similarity to any *other* requirement, vectorised.
        if n > 1:
            off_diagonal = sim_matrix.copy()
            np.fill_diagonal(off_diagonal, -np.inf)
            max_sims = off_diagonal.max(axis=1)
        else:
            max_sims = np.zeros(n)

        # Index conflicts by requirement once instead of scanning the full list per requirement.
        conflicts_by_req: Dict[str, List[Dict[str, Any]]] = {}
        for c in conflict_list:
            for own, other in (("req_a", "req_b"), ("req_b", "req_a")):
                conflicts_by_req.setdefault(c[f"{own}_id"], []).append({
                    "target_id": c[f"{other}_id"],
                    "target_text": c[f"{other}_text"],
                    "conflict_type": c["conflict_type"],
                    "explanation": c["explanation"],
                    "attribute": c.get("attribute"),
                    "value_a": c.get("value_a"),
                    "value_b": c.get("value_b"),
                })

        # 6. Detailed Per-Requirement Processing
        analyzed_requirements = []

        for idx, req in enumerate(raw_requirements):
            req_id = req["id"]
            text = req["text"]

            # Classification: Functional vs Non-Functional
            cls_result = self.classifier.classify(text)
            req_type = cls_result["type"]
            confidence = cls_result["confidence"]
            source = cls_result["classification_source"]

            # Ambiguity Detection
            amb_result = self.ambiguity.detect_ambiguity(text)
            is_ambiguous = amb_result["is_ambiguous"]
            ambiguous_terms = amb_result["ambiguous_terms"]
            amb_explanation = amb_result["ambiguity_explanation"]

            # Incompleteness Detection
            inc_result = self.incompleteness.detect_incompleteness(text)
            is_incomplete = inc_result["is_incomplete"]
            missing_elements = inc_result["missing_elements"]
            inc_explanation = inc_result["incompleteness_explanation"]

            # Smell Detection
            detected_smells = self.smells.detect_smells(
                text=text,
                is_ambiguous=is_ambiguous,
                ambiguity_explanation=amb_explanation,
                is_incomplete=is_incomplete,
                incompleteness_explanation=inc_explanation
            )

            # NER Entity Extraction
            entities = entities_per_req[idx]
            max_sim = float(max_sims[idx])

            has_dup = req_id in dup_ids
            has_conf = req_id in conflict_ids

            # Multi-Dimensional Quality Scoring
            score_data = self.scorer.calculate_score(
                text=text,
                is_ambiguous=is_ambiguous,
                ambiguous_terms=ambiguous_terms,
                is_incomplete=is_incomplete,
                missing_elements=missing_elements,
                has_conflict=has_conf,
                has_duplicate=has_dup,
                similarity_max=max_sim,
                req_type=req_type
            )

            # Related Requirements & Conflict References
            similar_refs = self.similarity.get_related_requirements(
                idx,
                raw_requirements,
                sim_matrix,
                threshold=0.60,
                duplicate_threshold=similarity_threshold,
            )
            
            conflict_refs = conflicts_by_req.get(req_id, [])

            # LLM / Deterministic Generation (Rewriting, User Story, Acceptance Criteria)
            enhanced = enhanced_per_req[idx]

            analyzed_requirements.append({
                "id": req_id,
                "text": text,
                "original_text": req["original_text"],
                "section": req.get("section", "General Requirements"),
                "line_number": req.get("line_number"),
                "type": req_type,
                "confidence": confidence,
                "classification_source": source,
                "nfr_category": cls_result.get("nfr_category"),
                "nfr_category_confidence": cls_result.get("nfr_category_confidence"),
                "quality_score": score_data["overall_score"],
                "scores": score_data["scores"],
                "smells": detected_smells,
                "is_ambiguous": is_ambiguous,
                "ambiguity_explanation": amb_explanation,
                "ambiguous_terms": ambiguous_terms,
                "is_incomplete": is_incomplete,
                "incompleteness_explanation": inc_explanation,
                "missing_elements": missing_elements,
                "entities": entities,
                "topic": req.get("topic", "General"),
                "topic_id": req.get("topic_id", 0),
                "similar_requirements": similar_refs,
                "potential_conflicts": conflict_refs,
                "improved_text": enhanced["improved_text"],
                "user_story": enhanced["user_story"],
                "acceptance_criteria": enhanced["acceptance_criteria"],
                "recommendation": score_data["recommendation"],
                "human_approved": False
            })

        # 7. Summary Metrics
        summary = self._compute_summary(
            analyzed_requirements,
            duplicates,
            conflict_list,
            topic_info_list,
            self.similarity.embedding_backend,
        )

        self.last_similarity = {
            "ids": [r["id"] for r in raw_requirements],
            "matrix": sim_matrix,
        }

        return {
            "document_name": document_name,
            "document_text": raw_text,
            "summary": summary,
            "requirements": analyzed_requirements,
            "duplicates": duplicates,
            "conflicts": conflict_list,
            "topics": topic_info_list
        }

    def _compute_summary(
        self,
        requirements: List[Dict[str, Any]],
        duplicates: List[Dict[str, Any]],
        conflicts: List[Dict[str, Any]],
        topics: List[Dict[str, Any]],
        embedding_backend: str = "tfidf-fallback",
    ) -> Dict[str, Any]:
        """Calculates aggregate statistics for the SRS dashboard."""
        total = len(requirements)
        func_count = sum(1 for r in requirements if r["type"] == "Functional")
        nfunc_count = sum(1 for r in requirements if r["type"] == "Non-Functional")
        amb_count = sum(1 for r in requirements if r["is_ambiguous"])
        inc_count = sum(1 for r in requirements if r["is_incomplete"])

        avg_score = round(sum(r["quality_score"] for r in requirements) / total, 1) if total > 0 else 0.0

        # Quality distribution buckets: 90-100 (Excellent), 75-89 (Good), 60-74 (Moderate), <60 (Poor)
        q_dist = {
            "Excellent (90-100)": sum(1 for r in requirements if r["quality_score"] >= 90),
            "Good (75-89)": sum(1 for r in requirements if 75 <= r["quality_score"] < 90),
            "Moderate (60-74)": sum(1 for r in requirements if 60 <= r["quality_score"] < 75),
            "Needs Improvement (<60)": sum(1 for r in requirements if r["quality_score"] < 60)
        }

        # Smell distribution
        smell_dist: Dict[str, int] = {}
        for r in requirements:
            for s in r["smells"]:
                s_name = s["smell"]
                smell_dist[s_name] = smell_dist.get(s_name, 0) + 1

        topic_dist = [
            {"topic": t["name"], "count": t["count"], "keywords": t["keywords"]}
            for t in topics
        ]

        return {
            "total_requirements": total,
            "functional_count": func_count,
            "non_functional_count": nfunc_count,
            "ambiguous_count": amb_count,
            "incomplete_count": inc_count,
            "duplicate_pairs_count": len(duplicates),
            "conflict_pairs_count": len(conflicts),
            "average_quality_score": avg_score,
            "quality_distribution": q_dist,
            "smell_distribution": smell_dist,
            "topic_distribution": topic_dist,
            "embedding_backend": embedding_backend,
        }

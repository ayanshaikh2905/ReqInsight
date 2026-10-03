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
        duplicates = self.similarity.find_duplicates(raw_requirements, threshold=similarity_threshold)
        dup_ids = set()
        for d in duplicates:
            if d["similarity"] >= 0.88:
                dup_ids.add(d["req_a_id"])
                dup_ids.add(d["req_b_id"])

        # 4. Conflict Detection
        conflict_list = self.conflicts.find_conflicts(raw_requirements, sim_matrix)
        conflict_ids = set()
        for c in conflict_list:
            conflict_ids.add(c["req_a_id"])
            conflict_ids.add(c["req_b_id"])

        # 5. Dynamic Topic Discovery
        topic_info_list = self.topics.discover_topics(raw_requirements, embeddings)

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
            entities = self.ner.extract_entities(text)

            # Max similarity with any other requirement
            other_sims = [sim_matrix[idx][j] for j in range(n) if j != idx]
            max_sim = max(other_sims) if other_sims else 0.0

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
            similar_refs = self.similarity.get_related_requirements(idx, raw_requirements, sim_matrix, threshold=0.60)
            
            conflict_refs = []
            for c in conflict_list:
                if c["req_a_id"] == req_id:
                    conflict_refs.append({
                        "target_id": c["req_b_id"],
                        "target_text": c["req_b_text"],
                        "conflict_type": c["conflict_type"],
                        "explanation": c["explanation"]
                    })
                elif c["req_b_id"] == req_id:
                    conflict_refs.append({
                        "target_id": c["req_a_id"],
                        "target_text": c["req_a_text"],
                        "conflict_type": c["conflict_type"],
                        "explanation": c["explanation"]
                    })

            # LLM / Deterministic Generation (Rewriting, User Story, Acceptance Criteria)
            enhanced = self.llm.enhance_requirement(text)

            analyzed_requirements.append({
                "id": req_id,
                "text": text,
                "original_text": req["original_text"],
                "section": req.get("section", "General Requirements"),
                "line_number": req.get("line_number"),
                "type": req_type,
                "confidence": confidence,
                "classification_source": source,
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
        summary = self._compute_summary(analyzed_requirements, duplicates, conflict_list, topic_info_list)

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
        topics: List[Dict[str, Any]]
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
            "Moderate (60-74)": sum(1 for r in requirements if 60 <= r["quality_score"] < 74),
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
            "topic_distribution": topic_dist
        }

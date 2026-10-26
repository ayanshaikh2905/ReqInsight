from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RequirementEntity(BaseModel):
    text: str
    category: str  # ACTOR, SYSTEM, TECHNOLOGY, DATA, ACTION, OBJECT
    explanation: Optional[str] = None


class SmellItem(BaseModel):
    smell: str
    description: str
    severity: str = "warning"  # info, warning, danger


class SimilarRequirementRef(BaseModel):
    target_id: str
    target_text: str
    similarity: float
    is_duplicate: bool


class ConflictRef(BaseModel):
    target_id: str
    target_text: str
    conflict_type: str
    explanation: str
    attribute: Optional[str] = None
    value_a: Optional[str] = None
    value_b: Optional[str] = None


class RequirementItem(BaseModel):
    id: str
    text: str
    original_text: str
    section: Optional[str] = "General Requirements"
    line_number: Optional[int] = None
    type: str = "Functional"  # "Functional" or "Non-Functional"
    confidence: float = 0.85
    classification_source: str = "Model prediction"  # Model prediction vs Rule-based
    nfr_category: Optional[str] = None  # e.g. Security, Usability (Non-Functional only)
    nfr_category_confidence: Optional[float] = None
    quality_score: int = 75
    scores: Dict[str, int] = Field(default_factory=lambda: {
        "clarity": 70,
        "completeness": 70,
        "specificity": 70,
        "consistency": 90,
        "testability": 70,
        "uniqueness": 90
    })
    smells: List[SmellItem] = Field(default_factory=list)
    is_ambiguous: bool = False
    ambiguity_explanation: Optional[str] = None
    ambiguous_terms: List[str] = Field(default_factory=list)
    is_incomplete: bool = False
    incompleteness_explanation: Optional[str] = None
    missing_elements: List[str] = Field(default_factory=list)
    entities: List[RequirementEntity] = Field(default_factory=list)
    topic: str = "General"
    topic_id: int = 0
    similar_requirements: List[SimilarRequirementRef] = Field(default_factory=list)
    potential_conflicts: List[ConflictRef] = Field(default_factory=list)
    improved_text: str = ""
    user_story: str = ""
    acceptance_criteria: str = ""
    recommendation: str = ""
    human_approved: bool = False


class DuplicatePair(BaseModel):
    req_a_id: str
    req_a_text: str
    req_b_id: str
    req_b_text: str
    similarity: float
    status: str = "Potential Duplicate"


class ConflictPair(BaseModel):
    req_a_id: str
    req_a_text: str
    req_b_id: str
    req_b_text: str
    conflict_type: str
    explanation: str
    confidence: float = 0.88
    attribute: Optional[str] = None
    value_a: Optional[str] = None
    value_b: Optional[str] = None


class TopicInfo(BaseModel):
    topic_id: int
    name: str
    count: int
    keywords: List[str] = Field(default_factory=list)
    requirement_ids: List[str] = Field(default_factory=list)


class AnalysisSummary(BaseModel):
    total_requirements: int = 0
    functional_count: int = 0
    non_functional_count: int = 0
    ambiguous_count: int = 0
    incomplete_count: int = 0
    duplicate_pairs_count: int = 0
    conflict_pairs_count: int = 0
    average_quality_score: float = 0.0
    quality_distribution: Dict[str, int] = Field(default_factory=dict)
    smell_distribution: Dict[str, int] = Field(default_factory=dict)
    topic_distribution: List[Dict[str, Any]] = Field(default_factory=list)
    embedding_backend: str = "tfidf-fallback"


class AnalysisResponse(BaseModel):
    document_name: str
    document_text: Optional[str] = None
    created_at: Optional[str] = None
    summary: AnalysisSummary
    requirements: List[RequirementItem]
    duplicates: List[DuplicatePair] = Field(default_factory=list)
    conflicts: List[ConflictPair] = Field(default_factory=list)
    topics: List[TopicInfo] = Field(default_factory=list)
    run_id: Optional[str] = None


class CorrectedRequirement(BaseModel):
    id: str
    original_text: str
    corrected_text: str
    status: str
    notes: str


class CorrectedSection(BaseModel):
    title: str
    requirements: List[CorrectedRequirement] = Field(default_factory=list)


class CorrectedDecision(BaseModel):
    req_a_id: str
    req_a_text: str
    req_b_id: str
    req_b_text: str
    conflict_type: str
    explanation: str


class MergedDuplicate(BaseModel):
    kept_id: str
    removed_id: str
    similarity: float
    kept_text: str
    removed_text: str


class CorrectedOpenItem(BaseModel):
    req_id: str
    placeholder: str


class CorrectedChange(BaseModel):
    req_id: str
    change_type: str
    before: str
    after: str
    reason: str


class CorrectedSummary(BaseModel):
    total: int = 0
    unchanged: int = 0
    reworded: int = 0
    merged: int = 0
    needs_decision: int = 0
    open_items: int = 0


class CorrectedSRSResponse(BaseModel):
    document_name: str
    sections: List[CorrectedSection] = Field(default_factory=list)
    needs_decision: List[CorrectedDecision] = Field(default_factory=list)
    merged_duplicates: List[MergedDuplicate] = Field(default_factory=list)
    open_items: List[CorrectedOpenItem] = Field(default_factory=list)
    changelog: List[CorrectedChange] = Field(default_factory=list)
    summary: CorrectedSummary


class EvaluationMetrics(BaseModel):
    classification: Dict[str, Any]
    nfr_category: Optional[Dict[str, Any]] = None
    ambiguity: Dict[str, Any]
    duplicates: Dict[str, Any]
    text_generation: Dict[str, Any]
    dataset_info: Dict[str, Any]
    evaluation_type: str = "Measured on PROMISE_exp with cross-validation"


class SettingsConfig(BaseModel):
    similarity_threshold: float = Field(0.85, ge=0.5, le=0.99)
    llm_provider: str = "fallback"  # openai, groq, ollama, mistral, fallback
    llm_model: str = "gpt-4o-mini"
    llm_api_key: Optional[str] = ""
    llm_api_base: Optional[str] = ""
    use_local_fallback: bool = True
    # Read-only on responses: whether a key is saved (the key itself is never returned).
    llm_api_key_set: bool = False


class RewriteRequest(BaseModel):
    requirement_id: Optional[str] = None
    text: str


class RewriteResponse(BaseModel):
    original_text: str
    improved_text: str
    method: str
    changes_made: List[str]


class UserStoryRequest(BaseModel):
    requirement_id: Optional[str] = None
    text: str


class UserStoryResponse(BaseModel):
    original_text: str
    user_story: str
    actor: str
    action: str
    benefit: str


class AcceptanceCriteriaRequest(BaseModel):
    requirement_id: Optional[str] = None
    text: str


class AcceptanceCriteriaResponse(BaseModel):
    original_text: str
    acceptance_criteria: str
    format: str = "Given-When-Then"


class AnalyzeTextRequest(BaseModel):
    text: str
    document_name: Optional[str] = "Manual Input SRS"


class RunSummary(BaseModel):
    run_id: str
    document_name: Optional[str] = None
    created_at: Optional[str] = None
    total_requirements: int = 0
    average_quality_score: float = 0.0
    ambiguous_count: int = 0
    incomplete_count: int = 0
    duplicate_pairs_count: int = 0
    conflict_pairs_count: int = 0


class MetricDelta(BaseModel):
    before: float
    after: float
    delta: float
    direction: str  # better | worse | same | neutral


class RunHeader(BaseModel):
    run_id: Optional[str] = None
    document_name: Optional[str] = None
    created_at: Optional[str] = None
    summary: Dict[str, Any] = Field(default_factory=dict)


class RequirementBrief(BaseModel):
    id: Optional[str] = None
    text: Optional[str] = None
    quality_score: Optional[int] = None
    issues: List[str] = Field(default_factory=list)


class RequirementChange(BaseModel):
    base_id: Optional[str] = None
    target_id: Optional[str] = None
    base_text: Optional[str] = None
    target_text: Optional[str] = None
    text_changed: bool
    match_similarity: float
    base_score: Optional[int] = None
    target_score: Optional[int] = None
    score_delta: int
    resolved_issues: List[str] = Field(default_factory=list)
    new_issues: List[str] = Field(default_factory=list)


class RequirementDiff(BaseModel):
    matched: int
    unchanged: int
    improved: int
    regressed: int
    changed: List[RequirementChange] = Field(default_factory=list)
    added: List[RequirementBrief] = Field(default_factory=list)
    removed: List[RequirementBrief] = Field(default_factory=list)


class ConflictBrief(BaseModel):
    req_a_id: str
    req_b_id: str
    req_a_text: Optional[str] = None
    req_b_text: Optional[str] = None
    conflict_type: Optional[str] = None
    attribute: Optional[str] = None


class ComparisonResponse(BaseModel):
    base: RunHeader
    target: RunHeader
    verdict: str  # improved | regressed | unchanged
    summary_delta: Dict[str, MetricDelta]
    issues: Dict[str, int]
    requirements: RequirementDiff
    conflicts: Dict[str, List[ConflictBrief]]

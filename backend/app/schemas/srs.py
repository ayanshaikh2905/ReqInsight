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


class RequirementItem(BaseModel):
    id: str
    text: str
    original_text: str
    section: Optional[str] = "General Requirements"
    line_number: Optional[int] = None
    type: str = "Functional"  # "Functional" or "Non-Functional"
    confidence: float = 0.85
    classification_source: str = "Model prediction"  # Model prediction vs Rule-based
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


class AnalysisResponse(BaseModel):
    document_name: str
    document_text: Optional[str] = None
    summary: AnalysisSummary
    requirements: List[RequirementItem]
    duplicates: List[DuplicatePair] = Field(default_factory=list)
    conflicts: List[ConflictPair] = Field(default_factory=list)
    topics: List[TopicInfo] = Field(default_factory=list)


class EvaluationMetrics(BaseModel):
    classification: Dict[str, Any]
    ambiguity: Dict[str, Any]
    duplicates: Dict[str, Any]
    text_generation: Dict[str, Any]
    dataset_info: Dict[str, Any]
    evaluation_type: str = "Measured on PROMISE & IEEE Benchmark Subsets"


class SettingsConfig(BaseModel):
    similarity_threshold: float = 0.85
    llm_provider: str = "fallback"  # openai, groq, ollama, mistral, fallback
    llm_model: str = "gpt-4o-mini"
    llm_api_key: Optional[str] = ""
    llm_api_base: Optional[str] = ""
    use_local_fallback: bool = True


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

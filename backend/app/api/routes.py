import os
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.responses import JSONResponse, PlainTextResponse

from backend.app.schemas.srs import (
    AnalysisResponse,
    RequirementItem,
    DuplicatePair,
    ConflictPair,
    TopicInfo,
    EvaluationMetrics,
    SettingsConfig,
    RewriteRequest,
    RewriteResponse,
    UserStoryRequest,
    UserStoryResponse,
    AcceptanceCriteriaRequest,
    AcceptanceCriteriaResponse,
    AnalyzeTextRequest
)
from backend.app.utils.document_parser import DocumentParser
from backend.app.services.pipeline_service import AnalysisPipeline
from backend.app.services.evaluation_service import EvaluationService
from backend.app.reports.report_generator import ReportGenerator
from backend.app.models.database import DatabaseManager

router = APIRouter()

# Global singleton pipeline & database instances
pipeline = AnalysisPipeline()
db = DatabaseManager()
evaluator = EvaluationService()

# In-memory cache of current active analysis for rapid filtering
current_analysis: Optional[Dict[str, Any]] = None
app_settings = SettingsConfig()
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEMO_SRS_PATH = PROJECT_ROOT / "data" / "sample" / "demo_srs.txt"


@router.post("/upload", response_model=AnalysisResponse)
async def upload_document(
    file: UploadFile = File(...),
    threshold: float = Form(0.85)
):
    """
    Uploads an SRS document (PDF, DOCX, or TXT), extracts text,
    and runs the full NLP/ML analysis pipeline.
    """
    global current_analysis
    filename = file.filename or "uploaded_srs.txt"
    content_bytes = await file.read()

    try:
        raw_text = DocumentParser.extract_text(filename, content_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Document parsing error: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="The uploaded document contains no readable text.")

    try:
        result = pipeline.run_pipeline(
            raw_text=raw_text,
            document_name=filename,
            similarity_threshold=threshold
        )
        current_analysis = result
        doc_id = str(uuid.uuid4())
        db.save_analysis(doc_id, filename, raw_text, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(e)}")


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_text(request: AnalyzeTextRequest):
    """
    Runs the full NLP pipeline on manually provided or pasted SRS text.
    """
    global current_analysis
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    try:
        result = pipeline.run_pipeline(
            raw_text=request.text,
            document_name=request.document_name or "Manual Input SRS",
            similarity_threshold=app_settings.similarity_threshold
        )
        current_analysis = result
        doc_id = str(uuid.uuid4())
        db.save_analysis(doc_id, request.document_name or "Manual Input SRS", request.text, result)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {str(e)}")


@router.get("/demo-srs", response_model=AnalysisResponse)
async def load_demo_srs():
    """
    PROFESSOR DEMO MODE:
    Loads a curated sample SRS with intentional flaws:
      - Ambiguous requirement ('The system should be very fast')
      - Duplicate requirements (password reset variations)
      - Contradictory requirements (minimum 8 chars vs maximum 6 chars)
      - Functional & Non-Functional requirements
      - Real-time quality scoring and IEEE 830 reformulations
    Requires ZERO external API keys. Works 100% offline!
    """
    global current_analysis
    if not DEMO_SRS_PATH.exists():
        raise HTTPException(status_code=404, detail="Demo SRS file not found on disk.")

    with DEMO_SRS_PATH.open("r", encoding="utf-8") as f:
        demo_text = f.read()

    result = pipeline.run_pipeline(
        raw_text=demo_text,
        document_name="Academic Demo SRS (Identity & E-Commerce Portal)",
        similarity_threshold=0.85
    )
    current_analysis = result
    doc_id = "DEMO-DOC-001"
    db.save_analysis(doc_id, "Academic Demo SRS", demo_text, result)
    return result


@router.get("/requirements", response_model=List[RequirementItem])
async def get_requirements(
    req_type: Optional[str] = Query(None, description="Filter by 'Functional' or 'Non-Functional'"),
    topic: Optional[str] = Query(None, description="Filter by topic"),
    ambiguous_only: bool = Query(False, description="Filter only ambiguous requirements"),
    incomplete_only: bool = Query(False, description="Filter only incomplete requirements"),
    search: Optional[str] = Query(None, description="Search query string")
):
    """
    Returns filtered and sorted requirements from the active analysis session.
    """
    analysis = _get_active_analysis()
    reqs = analysis.get("requirements", [])

    filtered = []
    for r in reqs:
        if req_type and r.get("type", "").lower() != req_type.lower():
            continue
        if topic and topic.lower() not in r.get("topic", "").lower():
            continue
        if ambiguous_only and not r.get("is_ambiguous", False):
            continue
        if incomplete_only and not r.get("is_incomplete", False):
            continue
        if search:
            query = search.lower()
            text_match = query in r.get("text", "").lower()
            id_match = query in r.get("id", "").lower()
            topic_match = query in r.get("topic", "").lower()
            if not (text_match or id_match or topic_match):
                continue
        filtered.append(r)

    return filtered


@router.get("/requirements/{req_id}", response_model=RequirementItem)
async def get_requirement_by_id(req_id: str):
    """
    Returns full analysis details for a single requirement ID.
    """
    analysis = _get_active_analysis()
    for r in analysis.get("requirements", []):
        if r.get("id") == req_id:
            return r
    raise HTTPException(status_code=404, detail=f"Requirement with ID '{req_id}' not found.")


@router.get("/duplicates", response_model=List[DuplicatePair])
async def get_duplicates(
    threshold: Optional[float] = Query(None, ge=0.5, le=0.99, description="Cosine similarity cutoff")
):
    """
    Returns detected duplicate and highly similar requirement pairs.
    """
    analysis = _get_active_analysis()
    cutoff = threshold if threshold is not None else app_settings.similarity_threshold
    
    # If custom threshold is provided, recompute pairs
    reqs = analysis.get("requirements", [])
    if threshold is not None and len(reqs) > 1:
        return pipeline.similarity.find_duplicates(reqs, threshold=cutoff)

    return analysis.get("duplicates", [])


@router.get("/conflicts", response_model=List[ConflictPair])
async def get_conflicts():
    """
    Returns detected contradictory or mutually incompatible requirements.
    """
    analysis = _get_active_analysis()
    return analysis.get("conflicts", [])


@router.get("/topics", response_model=List[TopicInfo])
async def get_topics():
    """
    Returns discovered topic clusters and associated keywords.
    """
    analysis = _get_active_analysis()
    return analysis.get("topics", [])


@router.get("/metrics", response_model=EvaluationMetrics)
async def get_evaluation_metrics():
    """
    Returns actual empirical evaluation benchmark results (Acc, Prec, Rec, F1, BLEU, ROUGE).
    """
    return evaluator.run_evaluation()


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_requirement(request: RewriteRequest):
    """
    On-demand requirement rewriting into standard IEEE 830 format.
    """
    res = pipeline.llm.rewriter.rewrite(request.text)
    return RewriteResponse(
        original_text=request.text,
        improved_text=res["improved_text"],
        method=res["method"],
        changes_made=res["changes_made"]
    )


@router.post("/user-story", response_model=UserStoryResponse)
async def generate_user_story(request: UserStoryRequest):
    """
    On-demand Agile User Story generation.
    """
    res = pipeline.llm.user_story_gen.generate_user_story(request.text)
    return UserStoryResponse(
        original_text=request.text,
        user_story=res["user_story"],
        actor=res["actor"],
        action=res["action"],
        benefit=res["benefit"]
    )


@router.post("/acceptance-criteria", response_model=AcceptanceCriteriaResponse)
async def generate_acceptance_criteria(request: AcceptanceCriteriaRequest):
    """
    On-demand Gherkin Given-When-Then criteria generation.
    """
    res = pipeline.llm.acceptance_gen.generate_criteria(request.text)
    return AcceptanceCriteriaResponse(
        original_text=request.text,
        acceptance_criteria=res["acceptance_criteria"],
        format=res["format"]
    )


@router.get("/report")
async def get_report_data():
    """
    Returns complete report summary data.
    """
    return _get_active_analysis()


@router.get("/export/{export_format}")
async def export_report(export_format: str):
    """
    Exports the SRS analysis report in PDF, JSON, or CSV format.
    """
    analysis = _get_active_analysis()
    fmt = export_format.lower()

    if fmt == "pdf":
        pdf_bytes = ReportGenerator.generate_pdf(analysis)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=ReqInsight_Analysis_Report.pdf"}
        )
    elif fmt == "json":
        json_str = ReportGenerator.generate_json(analysis)
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=ReqInsight_Analysis_Report.json"}
        )
    elif fmt == "csv":
        csv_str = ReportGenerator.generate_csv(analysis)
        return Response(
            content=csv_str,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=ReqInsight_Requirements.csv"}
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format '{export_format}'. Choose 'pdf', 'json', or 'csv'.")


@router.get("/settings", response_model=SettingsConfig)
async def get_settings():
    """
    Retrieves current application settings.
    """
    return app_settings


@router.post("/settings", response_model=SettingsConfig)
async def update_settings(new_settings: SettingsConfig):
    """
    Updates application settings at runtime.
    """
    global app_settings
    app_settings = new_settings
    pipeline.llm.update_config(
        provider=new_settings.llm_provider,
        api_key=new_settings.llm_api_key or "",
        model=new_settings.llm_model,
        api_base=new_settings.llm_api_base or ""
    )
    return app_settings


def _get_active_analysis() -> Dict[str, Any]:
    """Retrieves cached analysis or loads latest run from SQLite."""
    global current_analysis
    if current_analysis is not None:
        return current_analysis

    latest = db.get_latest_analysis()
    if latest is not None:
        current_analysis = latest
        return current_analysis

    # Default to loading demo SRS if no document has been analyzed yet
    if DEMO_SRS_PATH.exists():
        with DEMO_SRS_PATH.open("r", encoding="utf-8") as f:
            demo_text = f.read()
        res = pipeline.run_pipeline(demo_text, "Academic Demo SRS (Identity & E-Commerce Portal)")
        current_analysis = res
        db.save_analysis("DEFAULT-DEMO", "Academic Demo SRS", demo_text, res)
        return current_analysis

    raise HTTPException(status_code=404, detail="No active analysis found. Please upload an SRS document first.")

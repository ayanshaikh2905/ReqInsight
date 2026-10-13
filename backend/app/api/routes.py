import os
import threading
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
    AnalyzeTextRequest,
    CorrectedSRSResponse,
    RunSummary,
    ComparisonResponse,
)
from backend.app.utils.document_parser import DocumentParser
from backend.app.services.pipeline_service import AnalysisPipeline
from backend.app.services.evaluation_service import EvaluationService
from backend.app.reports.report_generator import ReportGenerator
from backend.app.reports.corrected_srs_builder import CorrectedSRSBuilder
from backend.app.models.database import DatabaseManager
from backend.app.services.comparison_service import ComparisonService

router = APIRouter()

# Global singleton pipeline & database instances
pipeline = AnalysisPipeline()
db = DatabaseManager()
evaluator = EvaluationService()
corrected_srs_builder = CorrectedSRSBuilder()
comparison_service = ComparisonService(pipeline.similarity)

# In-memory cache of current active analysis for rapid filtering
current_analysis: Optional[Dict[str, Any]] = None
app_settings = SettingsConfig()
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEMO_SRS_PATH = PROJECT_ROOT / "data" / "sample" / "demo_srs.txt"
DEMO_DOCUMENT_NAME = "Academic Demo SRS (Identity & E-Commerce Portal)"
MAX_UPLOAD_BYTES = int(os.getenv("REQINSIGHT_MAX_UPLOAD_MB", "20")) * 1024 * 1024
MAX_TEXT_CHARS = int(os.getenv("REQINSIGHT_MAX_TEXT_CHARS", "2000000"))
# Sync handlers run in a threadpool, so guard the shared "active analysis" pointer.
_analysis_lock = threading.Lock()


@router.post("/upload", response_model=AnalysisResponse)
def upload_document(
    file: UploadFile = File(...),
    threshold: Optional[float] = Form(None, ge=0.5, le=0.99)
):
    """
    Uploads an SRS document (PDF, DOCX, or TXT), extracts text,
    and runs the full NLP/ML analysis pipeline.
    """
    filename = file.filename or "uploaded_srs.txt"
    content_bytes = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(content_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is larger than the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
        )

    try:
        raw_text = DocumentParser.extract_text(filename, content_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Document parsing error: {str(e)}")

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="The uploaded document contains no readable text.")

    cutoff = threshold if threshold is not None else app_settings.similarity_threshold
    return _run_and_store(raw_text, filename, cutoff, doc_id=str(uuid.uuid4()))


@router.post("/analyze", response_model=AnalysisResponse)
def analyze_text(request: AnalyzeTextRequest):
    """
    Runs the full NLP pipeline on manually provided or pasted SRS text.
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    if len(request.text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=413, detail=f"Text exceeds the {MAX_TEXT_CHARS:,} character limit.")

    return _run_and_store(
        request.text,
        request.document_name or "Manual Input SRS",
        app_settings.similarity_threshold,
        doc_id=str(uuid.uuid4()),
    )


@router.get("/demo-srs", response_model=AnalysisResponse)
def load_demo_srs():
    """
    PROFESSOR DEMO MODE:
    Loads a curated sample SRS with intentional flaws:
    - Ambiguous and incomplete requirements
      - Duplicate requirements (password reset variations)
      - Contradictory requirements (minimum 8 chars vs maximum 6 chars)
      - Functional & Non-Functional requirements
      - Real-time quality scoring and IEEE 830 reformulations
    Requires ZERO external API keys. Works 100% offline!
    """
    if not DEMO_SRS_PATH.exists():
        raise HTTPException(status_code=404, detail="Demo SRS file not found on disk.")

    with DEMO_SRS_PATH.open("r", encoding="utf-8") as f:
        demo_text = f.read()

    return _run_and_store(demo_text, DEMO_DOCUMENT_NAME, 0.85, doc_id="DEMO-DOC-001")


@router.get("/requirements", response_model=List[RequirementItem])
def get_requirements(
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
def get_requirement_by_id(req_id: str):
    """
    Returns full analysis details for a single requirement ID.
    """
    analysis = _get_active_analysis()
    for r in analysis.get("requirements", []):
        if r.get("id") == req_id:
            return r
    raise HTTPException(status_code=404, detail=f"Requirement with ID '{req_id}' not found.")


@router.get("/duplicates", response_model=List[DuplicatePair])
def get_duplicates(
    threshold: Optional[float] = Query(None, ge=0.5, le=0.99, description="Cosine similarity cutoff")
):
    """
    Returns detected duplicate and highly similar requirement pairs.
    """
    analysis = _get_active_analysis()
    reqs = analysis.get("requirements", [])
    if threshold is None or len(reqs) < 2:
        return analysis.get("duplicates", [])

    # Re-threshold from the cached similarity matrix when it belongs to this analysis;
    # otherwise (e.g. restored from the database after a restart) encode once.
    cached = pipeline.last_similarity
    ids = [r["id"] for r in reqs]
    sim_matrix = cached["matrix"] if cached and cached["ids"] == ids else None
    pairs = pipeline.similarity.find_duplicates(reqs, threshold=threshold, sim_matrix=sim_matrix)

    # Pairs that conflict are reported as conflicts, not duplicates (same rule as the pipeline).
    conflict_pairs = {
        frozenset((c["req_a_id"], c["req_b_id"])) for c in analysis.get("conflicts", [])
    }
    return [p for p in pairs if frozenset((p["req_a_id"], p["req_b_id"])) not in conflict_pairs]


@router.get("/conflicts", response_model=List[ConflictPair])
def get_conflicts():
    """
    Returns detected contradictory or mutually incompatible requirements.
    """
    analysis = _get_active_analysis()
    return analysis.get("conflicts", [])


@router.get("/topics", response_model=List[TopicInfo])
def get_topics():
    """
    Returns discovered topic clusters and associated keywords.
    """
    analysis = _get_active_analysis()
    return analysis.get("topics", [])


@router.get("/metrics", response_model=EvaluationMetrics)
def get_evaluation_metrics(refresh: bool = Query(False, description="Recompute instead of using the cache")):
    """
    Returns empirical evaluation benchmark results (accuracy, precision, recall, F1).
    """
    return evaluator.run_evaluation(refresh=refresh)


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite_requirement(request: RewriteRequest):
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
def generate_user_story(request: UserStoryRequest):
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
def generate_acceptance_criteria(request: AcceptanceCriteriaRequest):
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
def get_report_data():
    """
    Returns complete report summary data.
    """
    return _get_active_analysis()


@router.get("/corrected-srs", response_model=CorrectedSRSResponse)
def get_corrected_srs():
    """Returns the corrected SRS representation for the active analysis."""
    return corrected_srs_builder.build(_get_active_analysis())


@router.get("/export/corrected/{export_format}")
def export_corrected_srs(export_format: str):
    """Exports the corrected SRS as DOCX, PDF, or plain text."""
    corrected = corrected_srs_builder.build(_get_active_analysis())
    fmt = export_format.lower()
    filename = f"ReqInsight_Corrected_SRS.{fmt}"
    if fmt == "docx":
        return Response(
            content=ReportGenerator.generate_corrected_srs_docx(corrected),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    if fmt == "pdf":
        return Response(
            content=ReportGenerator.generate_corrected_srs_pdf(corrected),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    if fmt == "txt":
        return Response(
            content=ReportGenerator.generate_corrected_srs_txt(corrected),
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    raise HTTPException(status_code=400, detail=f"Unsupported format '{export_format}'. Choose 'docx', 'pdf', or 'txt'.")


@router.get("/export/{export_format}")
def export_report(export_format: str):
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
def get_settings():
    """
    Retrieves current application settings. The API key itself is never returned.
    """
    return _public_settings()


@router.post("/settings", response_model=SettingsConfig)
def update_settings(new_settings: SettingsConfig):
    """
    Updates application settings at runtime.
    """
    global app_settings
    # A blank key means "keep the saved key" because the UI never receives the real one.
    api_key = new_settings.llm_api_key or app_settings.llm_api_key or ""
    app_settings = new_settings.model_copy(update={"llm_api_key": api_key})
    pipeline.llm.update_config(
        provider=new_settings.llm_provider,
        api_key=api_key,
        model=new_settings.llm_model,
        api_base=new_settings.llm_api_base or ""
    )
    return _public_settings()


# ---------------------------------------------------------------- history & compare

@router.get("/history", response_model=List[RunSummary])
def list_history(limit: int = Query(50, ge=1, le=500)):
    """Lists saved analysis runs, newest first (summaries only)."""
    return db.list_runs(limit=limit)


@router.get("/history/{run_id}", response_model=AnalysisResponse)
def get_history_run(run_id: str):
    """Returns the full stored analysis for one run without changing the active analysis."""
    run = db.get_analysis(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return run


@router.post("/history/{run_id}/activate", response_model=AnalysisResponse)
def activate_history_run(run_id: str):
    """Makes a stored run the active analysis used by every other page and export."""
    global current_analysis
    run = db.get_analysis(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    with _analysis_lock:
        current_analysis = run
    return run


@router.delete("/history/{run_id}")
def delete_history_run(run_id: str):
    """Deletes a stored run. The active analysis stays loaded until another is chosen."""
    if not db.delete_run(run_id):
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return {"deleted": run_id}


@router.get("/compare", response_model=ComparisonResponse)
def compare_runs(
    base: str = Query(..., description="Run ID of the earlier analysis"),
    target: str = Query(..., description="Run ID of the later analysis"),
):
    """Diffs two stored runs: score deltas, requirements added/removed/changed,
    issues resolved or introduced, and conflicts fixed or new."""
    if base == target:
        raise HTTPException(status_code=400, detail="Choose two different runs to compare.")
    base_run = db.get_analysis(base)
    target_run = db.get_analysis(target)
    missing = [rid for rid, run in ((base, base_run), (target, target_run)) if run is None]
    if missing:
        raise HTTPException(status_code=404, detail=f"Run(s) not found: {', '.join(missing)}")
    return comparison_service.compare(base_run, target_run)


def _public_settings() -> SettingsConfig:
    return app_settings.model_copy(update={
        "llm_api_key": "",
        "llm_api_key_set": bool(app_settings.llm_api_key),
    })


def _run_and_store(raw_text: str, document_name: str, threshold: float, doc_id: str) -> Dict[str, Any]:
    """Runs the pipeline, maps bad input to 422, persists the run and activates it."""
    global current_analysis
    try:
        result = pipeline.run_pipeline(
            raw_text=raw_text,
            document_name=document_name,
            similarity_threshold=threshold,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {str(e)}")

    result["run_id"] = db.save_analysis(doc_id, document_name, raw_text, result)
    with _analysis_lock:
        current_analysis = result
    return result


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
        return _run_and_store(demo_text, DEMO_DOCUMENT_NAME, 0.85, doc_id="DEFAULT-DEMO")

    raise HTTPException(status_code=404, detail="No active analysis found. Please upload an SRS document first.")

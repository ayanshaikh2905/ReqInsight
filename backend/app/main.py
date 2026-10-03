import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from backend.app.api.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup and shutdown hooks.
    Prepares NLP pipelines and logs configuration.
    """
    print("=" * 70)
    print("  ReqInsight AI — Software Requirement Analysis Backend Starting")
    print("  NLP Lab Project & Academic Requirement Engineering Suite")
    print("=" * 70)
    yield
    print("ReqInsight AI Backend shutting down.")


app = FastAPI(
    title="ReqInsight AI — Intelligent Software Requirement Analysis",
    description="Automated SRS text extraction, functional classification, ambiguity/conflict detection, quality scoring, and Agile user story generation.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration for React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {
        "project": "ReqInsight AI",
        "tagline": "Intelligent Software Requirement Analysis & Specification Generation",
        "version": "1.0.0",
        "status": "healthy",
        "docs_url": "/docs",
        "features": [
            "SRS Document Extraction (PDF, DOCX, TXT)",
            "Functional vs Non-Functional Classification",
            "Sentence-BERT Semantic Similarity & Duplicates",
            "Lexical & Metric Ambiguity Detection",
            "Structural Incompleteness Detection",
            "ISO 29148 Requirement Smells",
            "Incompatible Constraint & Polarity Conflict Detection",
            "Dynamic Topic Discovery & spaCy NER",
            "Multi-Dimensional 0-100 Quality Scoring",
            "IEEE 830 Rewriting & Agile User Story Generation",
            "Gherkin Given-When-Then Acceptance Criteria",
            "Executive PDF, JSON, and CSV Report Export",
            "One-Click Professor Demo Mode"
        ]
    }


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)

# ReqInsight AI

ReqInsight analyzes Software Requirements Specifications and surfaces requirement quality issues, duplicates, conflicts, topics, and rewrite suggestions. It includes a FastAPI backend and a React/Vite frontend.

## Run locally

### Backend

From the repository root, create or activate a Python 3.11+ environment and install dependencies:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r backend\requirements.txt
```

Start the API from the repository root:

```powershell
py -m uvicorn backend.app.main:app --reload --port 8000
```

The API docs are available at `http://localhost:8000/docs`.

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Upload page includes an offline demo SRS, so the application can be explored without an external LLM key.

## Checks

```powershell
py -m pytest -q
cd frontend
npm run lint
npm run build
```

The frontend uses `VITE_API_URL` when set; otherwise it targets `http://localhost:8000/api`.

## Benchmark

The requirement classifier is trained and evaluated on **PROMISE_exp**: 969 expert-labelled requirements from 47 software projects (Lima et al., SBES 2019), stored in `data/sample/promise_exp.csv`.

```powershell
py scripts/benchmark.py
```

This runs 10-fold cross-validation, leave-one-project-out testing, a model comparison and a pipeline speed test, then writes `reports/benchmark/BENCHMARK.md` and `results.json`. The **Evaluation** page shows the same measurements live.

| Task | Test | Result | Majority baseline |
| :--- | :--- | ---: | ---: |
| Functional vs Non-Functional | 10-fold cross-validation | 90.0% ± 2.8% accuracy, 89.9% macro F1 | 54.2% |
| Functional vs Non-Functional | Leave-one-project-out (47 projects) | 80.4% accuracy | 54.2% |
| Non-Functional category (11 classes) | 5-fold cross-validation | 72.4% accuracy | 23.8% |
| Full pipeline | 969 requirements in one document | ~12 s | n/a |

## History & Compare

Every analysis is saved automatically. The **History & Compare** page lists past runs,
re-opens any of them, and diffs two runs of a specification:

- quality-score and issue-count deltas (ambiguous, incomplete, duplicates, conflicts)
- requirements added, removed, reworded or re-scored — matched across runs even when
  they were renumbered or rephrased
- issues resolved vs. introduced per requirement, and conflicts fixed or new

API: `GET /api/history`, `GET /api/history/{run_id}`, `POST /api/history/{run_id}/activate`,
`DELETE /api/history/{run_id}`, `GET /api/compare?base=<run_id>&target=<run_id>`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `REQINSIGHT_EMBEDDINGS` | `auto` | `auto` uses Sentence-BERT when installed and cached, else the lexical fallback; `tfidf` skips SBERT entirely (fastest start, fully offline). |
| `REQINSIGHT_CORS_ORIGINS` | local Vite/React ports | Comma-separated allowed origins. |
| `REQINSIGHT_DB_PATH` | `backend/app/data/reqinsight.db` | SQLite file for history. |
| `REQINSIGHT_MAX_UPLOAD_MB` | `20` | Upload size limit. |
| `LLM_MAX_CONCURRENCY` | `6` | Parallel requests when a live LLM provider is configured. |
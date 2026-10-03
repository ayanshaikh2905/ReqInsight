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
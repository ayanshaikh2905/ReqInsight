import sqlite3
import json
import os
import uuid
from contextlib import closing
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class DatabaseManager:
    """
    Lightweight SQLite storage for ReqInsight AI documents and analysis runs.
    """

    def __init__(self, db_path: Optional[str] = None):
        default_path = Path(__file__).resolve().parent.parent / "data" / "reqinsight.db"
        self.db_path = db_path or os.getenv("REQINSIGHT_DB_PATH") or str(default_path)
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _init_db(self):
        with closing(self._get_connection()) as conn, conn:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    text_content TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS analysis_runs (
                    id TEXT PRIMARY KEY,
                    document_id TEXT,
                    summary_json TEXT,
                    requirements_json TEXT,
                    duplicates_json TEXT,
                    conflicts_json TEXT,
                    topics_json TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(document_id) REFERENCES documents(id)
                )
            """)
            # Older databases lack these columns; add them in place.
            existing = {row[1] for row in conn.execute("PRAGMA table_info(analysis_runs)")}
            if "document_name" not in existing:
                conn.execute("ALTER TABLE analysis_runs ADD COLUMN document_name TEXT")
            if "created_at_ms" not in existing:
                conn.execute("ALTER TABLE analysis_runs ADD COLUMN created_at_ms INTEGER")
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_runs_created ON analysis_runs(created_at_ms DESC, created_at DESC)"
            )
            conn.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)

    def save_analysis(self, doc_id: str, filename: str, doc_text: str, analysis_data: Dict[str, Any]) -> str:
        now = datetime.now(timezone.utc)
        # Timestamp prefix keeps IDs human-sortable; the random suffix makes them unique
        # even when several analyses finish within the same second.
        run_id = f"RUN-{now.strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"
        with closing(self._get_connection()) as conn, conn:
            conn.execute("""
                INSERT INTO documents (id, filename, text_content)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    filename = excluded.filename,
                    text_content = excluded.text_content
            """, (doc_id, filename, doc_text))
            conn.execute("""
                INSERT INTO analysis_runs (
                    id, document_id, document_name, summary_json, requirements_json,
                    duplicates_json, conflicts_json, topics_json, created_at, created_at_ms
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                run_id,
                doc_id,
                analysis_data.get("document_name") or filename,
                json.dumps(analysis_data.get("summary", {})),
                json.dumps(analysis_data.get("requirements", [])),
                json.dumps(analysis_data.get("duplicates", [])),
                json.dumps(analysis_data.get("conflicts", [])),
                json.dumps(analysis_data.get("topics", [])),
                now.strftime("%Y-%m-%d %H:%M:%S"),
                int(now.timestamp() * 1000),
            ))
        return run_id

    _RUN_COLUMNS = """
        r.id, COALESCE(r.document_name, d.filename), d.text_content, r.summary_json,
        r.requirements_json, r.duplicates_json, r.conflicts_json, r.topics_json, r.created_at
    """
    _ORDER = "ORDER BY COALESCE(r.created_at_ms, 0) DESC, r.created_at DESC, r.rowid DESC"

    @staticmethod
    def _row_to_analysis(row) -> Dict[str, Any]:
        return {
            "run_id": row[0],
            "document_name": row[1],
            "document_text": row[2],
            "summary": json.loads(row[3]),
            "requirements": json.loads(row[4]),
            "duplicates": json.loads(row[5]),
            "conflicts": json.loads(row[6]),
            "topics": json.loads(row[7]),
            "created_at": row[8],
        }

    def get_latest_analysis(self) -> Optional[Dict[str, Any]]:
        with closing(self._get_connection()) as conn:
            row = conn.execute(f"""
                SELECT {self._RUN_COLUMNS}
                FROM analysis_runs r JOIN documents d ON r.document_id = d.id
                {self._ORDER} LIMIT 1
            """).fetchone()
        return self._row_to_analysis(row) if row else None

    def get_analysis(self, run_id: str) -> Optional[Dict[str, Any]]:
        with closing(self._get_connection()) as conn:
            row = conn.execute(f"""
                SELECT {self._RUN_COLUMNS}
                FROM analysis_runs r JOIN documents d ON r.document_id = d.id
                WHERE r.id = ?
            """, (run_id,)).fetchone()
        return self._row_to_analysis(row) if row else None

    def list_runs(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Lightweight run listing (summary only, no requirement payloads)."""
        with closing(self._get_connection()) as conn:
            rows = conn.execute(f"""
                SELECT r.id, COALESCE(r.document_name, d.filename), r.created_at, r.summary_json
                FROM analysis_runs r JOIN documents d ON r.document_id = d.id
                {self._ORDER} LIMIT ?
            """, (limit,)).fetchall()
        runs = []
        for run_id, name, created_at, summary_json in rows:
            summary = json.loads(summary_json or "{}")
            runs.append({
                "run_id": run_id,
                "document_name": name,
                "created_at": created_at,
                "total_requirements": summary.get("total_requirements", 0),
                "average_quality_score": summary.get("average_quality_score", 0.0),
                "ambiguous_count": summary.get("ambiguous_count", 0),
                "incomplete_count": summary.get("incomplete_count", 0),
                "duplicate_pairs_count": summary.get("duplicate_pairs_count", 0),
                "conflict_pairs_count": summary.get("conflict_pairs_count", 0),
            })
        return runs

    def delete_run(self, run_id: str) -> bool:
        with closing(self._get_connection()) as conn, conn:
            cur = conn.execute("DELETE FROM analysis_runs WHERE id = ?", (run_id,))
            return cur.rowcount > 0

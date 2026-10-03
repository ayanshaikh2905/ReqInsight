import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime


class DatabaseManager:
    """
    Lightweight SQLite storage for ReqInsight AI documents and analysis runs.
    """

    def __init__(self, db_path: Optional[str] = None):
        default_path = Path(__file__).resolve().parent.parent / "data" / "reqinsight.db"
        self.db_path = db_path or str(default_path)
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _get_connection(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    text_content TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
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
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)
            conn.commit()

    def save_analysis(self, doc_id: str, filename: str, doc_text: str, analysis_data: Dict[str, Any]):
        run_id = f"RUN-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT OR REPLACE INTO documents (id, filename, text_content)
                VALUES (?, ?, ?)
            """, (doc_id, filename, doc_text))
            
            cursor.execute("""
                INSERT INTO analysis_runs (id, document_id, summary_json, requirements_json, duplicates_json, conflicts_json, topics_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                run_id,
                doc_id,
                json.dumps(analysis_data.get("summary", {})),
                json.dumps(analysis_data.get("requirements", [])),
                json.dumps(analysis_data.get("duplicates", [])),
                json.dumps(analysis_data.get("conflicts", [])),
                json.dumps(analysis_data.get("topics", []))
            ))
            conn.commit()
        return run_id

    def get_latest_analysis(self) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT d.filename, d.text_content, r.summary_json, r.requirements_json, r.duplicates_json, r.conflicts_json, r.topics_json
                FROM analysis_runs r
                JOIN documents d ON r.document_id = d.id
                ORDER BY r.created_at DESC LIMIT 1
            """)
            row = cursor.fetchone()
            if not row:
                return None
            return {
                "document_name": row[0],
                "document_text": row[1],
                "summary": json.loads(row[2]),
                "requirements": json.loads(row[3]),
                "duplicates": json.loads(row[4]),
                "conflicts": json.loads(row[5]),
                "topics": json.loads(row[6])
            }

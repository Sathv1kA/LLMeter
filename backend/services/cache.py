"""
Report cache — stores analysis results in SQLite so they can be shared via
short URL (`/r/<id>`) without re-running the scan.

Schema is deliberately tiny:
  reports(id TEXT PRIMARY KEY, repo_url TEXT, payload TEXT, created_at TEXT)

Cached JSON is the full CostReport as returned by `/analyze`. The id is an
8-character urlsafe token.

Connection is opened lazily so import stays safe on read-only filesystems
(e.g. Vercel serverless, where only `/tmp` is writable). When the configured
path isn't writable and no fallback is allowed, save/load degrade to no-ops
rather than crashing the app.
"""
from __future__ import annotations

import json
import logging
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Lock
from typing import Optional

from config import settings

log = logging.getLogger(__name__)

_LOCK = Lock()
_conn: Optional[sqlite3.Connection] = None
_init_attempted = False


def _ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS reports (
            id         TEXT PRIMARY KEY,
            repo_url   TEXT NOT NULL,
            payload    TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at)")
    conn.commit()


def _try_open(path: Path) -> Optional[sqlite3.Connection]:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False because FastAPI serves from multiple threads;
        # we guard writes with a module-level lock.
        conn = sqlite3.connect(str(path), check_same_thread=False)
        _ensure_schema(conn)
        return conn
    except (sqlite3.OperationalError, OSError) as exc:
        log.warning("cache: failed to open %s (%s)", path, exc)
        return None


def _get_conn() -> Optional[sqlite3.Connection]:
    """Lazy, resilient connect.

    Tries the configured path; if that's read-only (serverless), falls back
    to /tmp/cache.db. Returns None (cache disabled) only if even that fails.
    """
    global _conn, _init_attempted
    if _conn is not None:
        return _conn
    if _init_attempted:
        return _conn  # already tried and failed; don't spam

    with _LOCK:
        if _conn is not None:
            return _conn
        _init_attempted = True

        conn = _try_open(settings.cache_db_path)
        if conn is None:
            fallback = Path("/tmp/cache.db")
            if fallback != settings.cache_db_path:
                log.info("cache: falling back to %s", fallback)
                conn = _try_open(fallback)

        _conn = conn
        if _conn is None:
            log.warning("cache: disabled — share links will not work")
        return _conn


def _new_id() -> str:
    return secrets.token_urlsafe(6)  # ~8 chars, URL-safe


def save_report(report_dict: dict, repo_url: str) -> Optional[str]:
    """Persist a report and return its short id, or None if cache is disabled."""
    conn = _get_conn()
    if conn is None:
        return None
    rid = _new_id()
    payload = json.dumps(report_dict, separators=(",", ":"), default=str)
    created_at = datetime.now(timezone.utc).isoformat()
    try:
        with _LOCK:
            conn.execute(
                "INSERT INTO reports (id, repo_url, payload, created_at) VALUES (?, ?, ?, ?)",
                (rid, repo_url, payload, created_at),
            )
            conn.commit()
        return rid
    except (sqlite3.OperationalError, sqlite3.DatabaseError) as exc:
        log.warning("cache: save failed (%s)", exc)
        return None


def load_report(report_id: str) -> Optional[dict]:
    """Fetch a report by id, or None if missing / expired / cache disabled."""
    conn = _get_conn()
    if conn is None:
        return None
    try:
        with _LOCK:
            cur = conn.execute(
                "SELECT payload, created_at FROM reports WHERE id = ?",
                (report_id,),
            )
            row = cur.fetchone()
    except (sqlite3.OperationalError, sqlite3.DatabaseError) as exc:
        log.warning("cache: load failed (%s)", exc)
        return None
    if row is None:
        return None
    payload_str, created_at_str = row
    try:
        created_at = datetime.fromisoformat(created_at_str)
    except ValueError:
        created_at = datetime.now(timezone.utc)
    if datetime.now(timezone.utc) - created_at > timedelta(days=settings.cache_ttl_days):
        return None
    try:
        return json.loads(payload_str)
    except json.JSONDecodeError:
        return None


def purge_expired() -> int:
    """Drop rows older than TTL. Returns count deleted (0 if cache disabled)."""
    conn = _get_conn()
    if conn is None:
        return 0
    cutoff = (datetime.now(timezone.utc) - timedelta(days=settings.cache_ttl_days)).isoformat()
    try:
        with _LOCK:
            cur = conn.execute("DELETE FROM reports WHERE created_at < ?", (cutoff,))
            conn.commit()
            return cur.rowcount
    except (sqlite3.OperationalError, sqlite3.DatabaseError) as exc:
        log.warning("cache: purge failed (%s)", exc)
        return 0

"""
GET /reports/{id} — fetch a previously-cached analysis report.
Used by the frontend /r/:id share-link route.
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException

from services.cache import load_report

router = APIRouter()

# Cache ids are `secrets.token_urlsafe(6)` → base64url of 6 bytes = 8 chars
# Accept a small range to tolerate future format changes without opening the
# route to arbitrary path-like strings.
_ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,24}$")


@router.get("/reports/{report_id}")
def get_report(report_id: str):
    if not _ID_RE.match(report_id):
        raise HTTPException(status_code=400, detail="Invalid report id.")
    report = load_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found or expired.")
    return report

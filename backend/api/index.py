"""
Vercel serverless entrypoint.

Vercel's Python runtime discovers a module-level `app` (or `handler`)
symbol and serves it as an ASGI application. This file just re-exports
the FastAPI instance defined in `backend/main.py`.

Keeping this as a thin shim means `main.py` stays identical for local
`uvicorn main:app --reload` and for the Docker image.
"""
from __future__ import annotations

import sys
from pathlib import Path

# When Vercel invokes `backend/api/index.py`, the sibling backend/ modules
# (config, routers, services, ...) are not automatically on sys.path. Prepend
# the backend/ directory so the existing absolute imports in main.py resolve.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from main import app  # noqa: E402, F401  (re-export for the runtime)

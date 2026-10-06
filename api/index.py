"""
Vercel entry point: the whole FastAPI backend runs as one Python function.

vercel.json sends /api/... and /health to this file. The app sees the original
path (for example /api/query), which matches the routes defined in rag/app.py,
so the app is exposed as-is. The React frontend is served by Vercel's CDN from
frontend/dist, not by this function.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag.app import app  # noqa: E402,F401  (Vercel looks for a variable named `app`)

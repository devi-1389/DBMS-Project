"""
Vercel entry point.

Vercel's Python runtime imports this file and serves the WSGI application named `app`.
On your own computer keep using `python run.py` - this file is only used by Vercel.
"""
import os
import sys

# make the project root importable (config.py, app/, database/)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402

app = create_app()

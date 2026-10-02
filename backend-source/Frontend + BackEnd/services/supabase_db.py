"""Centralized server-side Supabase connection for the Flask backend.

Phase 1 only: provides configuration detection and a safe connectivity
check. No game/auth logic is migrated here yet.

Security:
- SUPABASE_SERVICE_ROLE_KEY is backend-only. Never import this module
  from frontend code and never expose the key via any API response.
- This module never logs or returns secret values.
"""

import os
import time
from urllib.parse import urlparse

try:
    # Optional: load backend .env for local development if available.
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    # dotenv is optional; environment variables still work without it.
    pass

_supabase_client = None


def _get_env(name):
    value = os.environ.get(name, "")
    return value.strip() if isinstance(value, str) else ""


def get_supabase_url():
    """Return configured SUPABASE_URL or empty string (never raises)."""
    return _get_env("SUPABASE_URL")


def is_supabase_configured():
    """True only when both URL and service-role key are present."""
    return bool(get_supabase_url() and _get_env("SUPABASE_SERVICE_ROLE_KEY"))


def get_safe_config_status():
    """Return safe, non-secret config metadata for health checks.

    Exposes only whether values are set plus the URL hostname so
    operators can verify configuration without leaking secrets.
    """
    url = get_supabase_url()
    host = ""
    if url:
        try:
            host = urlparse(url).hostname or ""
        except Exception:
            host = ""
    return {
        "supabase_url_set": bool(url),
        "service_role_key_set": bool(_get_env("SUPABASE_SERVICE_ROLE_KEY")),
        "supabase_host": host,
    }


import threading

_local = threading.local()


def get_supabase_client():
    """Return a thread-local Supabase client, or None if not configured.

    Uses thread-local storage so concurrent requests / threads each get
    an isolated connection pool without HTTP/2 stream multiplexing collisions.
    """
    url = get_supabase_url()
    key = _get_env("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        return None

    client = getattr(_local, "client", None)
    if client is not None:
        return client

    try:
        from supabase import create_client  # type: ignore
        client = create_client(url, key)
        _local.client = client
        return client
    except Exception:
        return None


def reset_supabase_client():
    """Reset the cached client (useful for tests)."""
    if hasattr(_local, "client"):
        delattr(_local, "client")


def check_supabase_connection(timeout_seconds=10):
    """Perform a lightweight read to verify Supabase is reachable.

    Returns a dict with no secrets:
      { configured, connected, latency_ms, table, error }
    Never raises.
    """
    started = time.time()
    if not is_supabase_configured():
        return {
            "configured": False,
            "connected": False,
            "latency_ms": 0,
            "table": None,
            "error": "Supabase is not configured (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY).",
        }

    client = get_supabase_client()
    if client is None:
        return {
            "configured": True,
            "connected": False,
            "latency_ms": int((time.time() - started) * 1000),
            "table": None,
            "error": "Supabase client could not be created. Check credentials and that the 'supabase' package is installed.",
        }

    # Lightweight, read-only probe against a table known from migration 001.
    # game_settings always exists after the initial migration.
    try:
        client.table("game_settings").select("id").limit(1).execute()
        return {
            "configured": True,
            "connected": True,
            "latency_ms": int((time.time() - started) * 1000),
            "table": "game_settings",
            "error": None,
        }
    except Exception as exc:
        # Do not include secret values; only the exception message.
        return {
            "configured": True,
            "connected": False,
            "latency_ms": int((time.time() - started) * 1000),
            "table": "game_settings",
            "error": str(exc)[:300],
        }

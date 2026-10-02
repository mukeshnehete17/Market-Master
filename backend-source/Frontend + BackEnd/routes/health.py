"""Safe health-check endpoints (Phase 1).

- GET /api/health      -> backend liveness, no secrets.
- GET /api/health/db   -> Supabase connectivity status, no secrets.

These endpoints never return SUPABASE_URL full value beyond hostname,
and never return SUPABASE_SERVICE_ROLE_KEY.
"""

from flask import jsonify

from services.supabase_db import (
    check_supabase_connection,
    get_safe_config_status,
    is_supabase_configured,
)


def health():
    return jsonify({
        "success": True,
        "status": "ok",
        "service": "market-master-backend",
    }), 200


def health_db():
    config = get_safe_config_status()
    probe = check_supabase_connection()

    if not is_supabase_configured():
        # Local dev without credentials: backend is fine, DB not configured.
        return jsonify({
            "success": True,
            "status": "not_configured",
            "message": "Backend is running. Supabase credentials are not set.",
            "supabase": {
                "configured": False,
                "connected": False,
                "supabase_host": config.get("supabase_host", ""),
                "supabase_url_set": config.get("supabase_url_set", False),
                "service_role_key_set": config.get("service_role_key_set", False),
                "latency_ms": probe.get("latency_ms", 0),
            },
        }), 200

    if probe.get("connected"):
        return jsonify({
            "success": True,
            "status": "ok",
            "message": "Supabase is reachable.",
            "supabase": {
                "configured": True,
                "connected": True,
                "supabase_host": config.get("supabase_host", ""),
                "latency_ms": probe.get("latency_ms", 0),
                "table": probe.get("table"),
            },
        }), 200

    return jsonify({
        "success": False,
        "status": "unreachable",
        "message": "Supabase is configured but not reachable.",
        "supabase": {
            "configured": True,
            "connected": False,
            "supabase_host": config.get("supabase_host", ""),
            "latency_ms": probe.get("latency_ms", 0),
            "error": probe.get("error"),
        },
    }), 503

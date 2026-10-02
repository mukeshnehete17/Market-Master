from flask import request, jsonify, session

from services.auth_service import safe_user
from services.auth_store import find_profile_by_email, find_profile_by_id
from services.verify_token import verify_token


def _fresh_user_by_id(user_id):
    """Re-read the profile to enforce current status. Returns safe user or None."""
    row = find_profile_by_id(user_id)
    if row:
        status = (row.get("status") or "active").lower()
        if status != "active":
            return None
        return safe_user(row)
    return None


def me():
    # 1) Prefer JWT Bearer token (React stores mm_auth_token).
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1].strip()
        payload = verify_token(token)
        if payload:
            user_id = payload.get("sub", "")
            fresh = _fresh_user_by_id(user_id)
            if fresh:
                return jsonify({"success": True, "user": fresh}), 200
            # Backward compat: token for a legacy demo id with no profile row.
            if payload.get("name") and payload.get("role"):
                legacy = {
                    "id": user_id,
                    "name": payload.get("name"),
                    "role": payload.get("role"),
                }
                if payload.get("email"):
                    legacy["email"] = payload.get("email")
                return jsonify({"success": True, "user": legacy}), 200
        return jsonify({
            "success": False,
            "message": "Invalid or expired token."
        }), 401

    # 2) Fall back to Flask session cookie (set on login/signup).
    user_id = session.get("user_id")
    if user_id:
        row = find_profile_by_id(user_id)
        if row:
            status = (row.get("status") or "active").lower()
            if status != "active":
                return jsonify({
                    "success": False,
                    "message": "Account is not active."
                }), 401
            return jsonify({"success": True, "user": safe_user(row)}), 200
        # Legacy session without a profile row (pre-Phase-2 demo login).
        if session.get("player_name"):
            legacy = {
                "id": str(user_id),
                "name": session.get("player_name"),
                "role": session.get("role", "participant"),
            }
            if session.get("email"):
                legacy["email"] = session.get("email")
            return jsonify({"success": True, "user": legacy}), 200

    return jsonify({
        "success": False,
        "message": "Not authenticated."
    }), 401

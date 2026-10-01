from flask import request, jsonify

from services.verify_token import verify_token


def me():
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        return jsonify({
            "success": False,
            "message": "Authorization header missing."
        }), 401

    if not auth_header.startswith("Bearer "):
        return jsonify({
            "success": False,
            "message": "Invalid authorization format."
        }), 401

    token = auth_header.split(" ", 1)[1]

    payload = verify_token(token)

    if not payload:
        return jsonify({
            "success": False,
            "message": "Invalid or expired token."
        }), 401

    return jsonify({
        "success": True,
        "user": {
            "id": payload["sub"],
            "name": payload["name"],
            "role": payload["role"]
        }
    }), 200
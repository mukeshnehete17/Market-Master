from flask import request, jsonify

from services.authenticate_user import authenticate_user
from services.create_token import create_token


def login():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body is required."
        }), 400

    user_id = data.get("user_id")
    password = data.get("password")

    if not user_id or not password:
        return jsonify({
            "success": False,
            "message": "User ID and password are required."
        }), 400

    user = authenticate_user(user_id, password)

    if not user:
        return jsonify({
            "success": False,
            "message": "Invalid user ID or password."
        }), 401

    token = create_token(user)
    
    from flask import session
    session['user_id'] = user['id']
    session['player_name'] = user['name']
    session['role'] = user['role']
    session.modified = True

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": user
    }), 200
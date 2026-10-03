from flask import request, jsonify, session

from services.auth_service import login as login_user
from services.create_token import create_token
from services.db_errors import DatabaseUnavailable


def login():
    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({
                "success": False,
                "message": "Request body is required."
            }), 400

        # Preferred: { email, password }. Legacy clients sent { user_id, password },
        # where user_id may be an email or an old demo id — both still accepted.
        identifier = str(data.get("email") or data.get("user_id") or "").strip()
        password = str(data.get("password") or "")

        if not identifier or not password:
            return jsonify({
                "success": False,
                "message": "Email and password are required."
            }), 400

        user, error, status = login_user(identifier, password)

        if error:
            return jsonify({
                "success": False,
                "message": error,
            }), status

        token = create_token(user)

        session['user_id'] = user['id']
        session['player_name'] = user['name']
        session['email'] = user.get('email', '')
        session['role'] = user.get('role', 'participant')
        session.modified = True

        return jsonify({
            "success": True,
            "message": "Login successful.",
            "token": token,
            "user": user,
        }), 200
    except DatabaseUnavailable:
        return jsonify({
            "success": False,
            "message": "Database is temporarily unavailable. Please try again shortly."
        }), 503
    except Exception:
        return jsonify({
            "success": False,
            "message": "An unexpected error occurred during login. Please try again."
        }), 500

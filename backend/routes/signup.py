from flask import request, jsonify, session

from services.auth_service import signup as signup_user
from services.create_token import create_token
from services.db_errors import DatabaseUnavailable


def signup():
    try:
        data = request.get_json(silent=True)

        if not data:
            return jsonify({
                "success": False,
                "message": "Request body is required."
            }), 400

        # NOTE: any client-supplied 'role' is intentionally ignored;
        # services/auth_service.py always creates role='participant'.
        user, error = signup_user(
            name=data.get("name", ""),
            email=data.get("email", ""),
            password=data.get("password", ""),
            confirm_password=data.get("confirm_password", ""),
        )

        if error:
            status = 409 if "already exists" in error.lower() else 400
            return jsonify({
                "success": False,
                "message": error,
            }), status

        token = create_token(user)

        # Establish Flask session (auto-login after signup).
        session['user_id'] = user['id']
        session['player_name'] = user['name']
        session['email'] = user.get('email', '')
        session['role'] = user.get('role', 'participant')
        session.modified = True

        return jsonify({
            "success": True,
            "message": "Account created successfully.",
            "token": token,
            "user": user,
        }), 201
    except DatabaseUnavailable:
        return jsonify({
            "success": False,
            "message": "Database is temporarily unavailable. Please try again shortly."
        }), 503
    except Exception:
        return jsonify({
            "success": False,
            "message": "An unexpected error occurred during signup. Please try again."
        }), 500

from flask import jsonify, session


def logout():
    """Clear session data on logout."""
    session.clear()
    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    }), 200

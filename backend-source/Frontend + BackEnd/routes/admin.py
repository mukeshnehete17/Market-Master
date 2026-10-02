"""Admin API (Phases 6, 8-12). All routes require an admin role.

- 401 when unauthenticated, 403 when authenticated but not admin.
- Role is determined server-side from the profiles row; client values
  are never trusted.
"""
from functools import wraps

from flask import Blueprint, jsonify, request, session

from services import admin_service as svc
from services import game_store as gs
from services.auth_store import find_profile_by_id
from services.questions_service import (
    admin_archive_question,
    admin_create_question,
    admin_delete_question,
    admin_list_questions,
    admin_update_question,
)
from services.game_store import get_question_row
from services.verify_token import verify_token

admin_api = Blueprint('admin_api', __name__, url_prefix='/api/admin')


def _resolve_identity():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        payload = verify_token(auth.split(" ", 1)[1].strip())
        if payload:
            row = find_profile_by_id(payload.get("sub", ""))
            if row:
                return row
    uid = session.get("user_id")
    if uid:
        row = find_profile_by_id(uid)
        if row:
            return row
    return None


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        ident = _resolve_identity()
        if not ident:
            return jsonify({"success": False, "message": "Not authenticated."}), 401
        if (ident.get("role") or "") != "admin":
            return jsonify({"success": False, "message": "Admin access required."}), 403
        if (ident.get("status") or "active") != "active":
            return jsonify({"success": False, "message": "Account is not active."}), 403
        request.admin_user = ident
        return fn(*args, **kwargs)
    return wrapper


@admin_api.route('/overview', methods=['GET'])
@require_admin
def overview():
    return jsonify({"success": True, "metrics": svc.dashboard_metrics()}), 200


# ---------------- students ----------------

@admin_api.route('/students', methods=['GET'])
@require_admin
def students_list():
    return jsonify({"success": True, "students": svc.list_students(
        search=request.args.get("search", ""),
        status_filter=request.args.get("status", ""),
        role_filter=request.args.get("role", ""))}), 200


@admin_api.route('/students/<user_id>', methods=['GET'])
@require_admin
def student_detail(user_id):
    detail = svc.get_student_detail(user_id)
    if not detail:
        return jsonify({"success": False, "message": "Student not found."}), 404
    return jsonify({"success": True, "student": detail}), 200


@admin_api.route('/students', methods=['POST'])
@require_admin
def student_create():
    data = request.get_json(silent=True) or {}
    row, err = svc.admin_create_student(request.admin_user["id"], data)
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "student": row}), 201


@admin_api.route('/students/<user_id>', methods=['PATCH'])
@require_admin
def student_update(user_id):
    data = request.get_json(silent=True) or {}
    row, err = svc.admin_update_student(request.admin_user["id"], user_id, data)
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "student": row}), 200


@admin_api.route('/students/<user_id>/disable', methods=['POST'])
@require_admin
def student_disable(user_id):
    row, err = svc.admin_set_student_status(request.admin_user["id"], user_id, "disabled")
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "student": row}), 200


@admin_api.route('/students/<user_id>/enable', methods=['POST'])
@require_admin
def student_enable(user_id):
    row, err = svc.admin_set_student_status(request.admin_user["id"], user_id, "active")
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "student": row}), 200


# ---------------- questions ----------------

@admin_api.route('/questions', methods=['GET'])
@require_admin
def questions_list():
    include = request.args.get("include_inactive", "1") != "0"
    return jsonify({"success": True,
                    "questions": admin_list_questions(include_inactive=include)}), 200


@admin_api.route('/questions', methods=['POST'])
@require_admin
def question_create():
    data = request.get_json(silent=True) or {}
    row, err = admin_create_question(data)
    if err:
        return jsonify({"success": False, "message": err}), 400
    svc.log_action(request.admin_user["id"], "question.create", "question",
                   row.get("id"), {})
    return jsonify({"success": True, "question": row}), 201


@admin_api.route('/questions/<qid>', methods=['GET'])
@require_admin
def question_detail(qid):
    row = get_question_row(qid)
    if not row:
        return jsonify({"success": False, "message": "Question not found."}), 404
    return jsonify({"success": True, "question": row}), 200


@admin_api.route('/questions/<qid>', methods=['PATCH'])
@require_admin
def question_update(qid):
    data = request.get_json(silent=True) or {}
    row, err = admin_update_question(qid, data)
    if err:
        return jsonify({"success": False, "message": err}), 400
    svc.log_action(request.admin_user["id"], "question.update", "question", qid,
                   {"fields": sorted(data.keys())})
    return jsonify({"success": True, "question": row}), 200


@admin_api.route('/questions/<qid>', methods=['DELETE'])
@require_admin
def question_delete(qid):
    ok, err = admin_delete_question(qid, game_store=gs)
    if not ok:
        return jsonify({"success": False, "message": err}), 400
    svc.log_action(request.admin_user["id"], "question.delete", "question", qid, {})
    return jsonify({"success": True}), 200


@admin_api.route('/questions/<qid>/archive', methods=['POST'])
@require_admin
def question_archive(qid):
    row, err = admin_archive_question(qid)
    if err:
        return jsonify({"success": False, "message": err}), 400
    svc.log_action(request.admin_user["id"], "question.archive", "question", qid, {})
    return jsonify({"success": True, "question": row}), 200


# ---------------- games ----------------

@admin_api.route('/games', methods=['GET'])
@require_admin
def games_list():
    return jsonify({"success": True, "games": svc.list_games()}), 200


@admin_api.route('/games', methods=['POST'])
@require_admin
def game_create():
    data = request.get_json(silent=True) or {}
    row, err = svc.admin_create_game(request.admin_user["id"], data,
                                     request.admin_user["id"])
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "game": row}), 201


@admin_api.route('/games/<game_id>', methods=['GET'])
@require_admin
def game_detail(game_id):
    row = svc.get_game_detail(game_id)
    if not row:
        return jsonify({"success": False, "message": "Game not found."}), 404
    return jsonify({"success": True, "game": row}), 200


@admin_api.route('/games/<game_id>', methods=['PATCH'])
@require_admin
def game_update(game_id):
    data = request.get_json(silent=True) or {}
    row, err = svc.admin_update_game(request.admin_user["id"], game_id, data)
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "game": row}), 200


@admin_api.route('/games/<game_id>', methods=['DELETE'])
@require_admin
def game_delete(game_id):
    ok, err = svc.admin_delete_game(request.admin_user["id"], game_id)
    if not ok:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True}), 200


@admin_api.route('/games/<game_id>/questions', methods=['PUT'])
@require_admin
def game_questions_set(game_id):
    data = request.get_json(silent=True) or {}
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return jsonify({"success": False, "message": "Game not found."}), 404
    if str(rows[0].get("status")) not in ("draft", "waiting"):
        return jsonify({"success": False,
                        "message": "Questions are locked once the game has started."}), 400
    err = svc.set_game_questions(game_id, data.get("question_ids") or [])
    if err:
        return jsonify({"success": False, "message": err}), 400
    svc.log_action(request.admin_user["id"], "game.questions.set", "game", game_id, {})
    return jsonify({"success": True, "game": svc.get_game_detail(game_id)}), 200


@admin_api.route('/games/<game_id>/<op>', methods=['POST'])
@require_admin
def game_control(game_id, op):
    allowed = ("start", "pause", "resume", "open-question", "close-market",
               "reveal", "settle", "next", "end", "cancel")
    if op not in allowed:
        return jsonify({"success": False, "message": "Unknown operation."}), 404
    row, err = svc.game_control(request.admin_user["id"], game_id, op)
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "game": row}), 200


@admin_api.route('/games/<game_id>/leaderboard', methods=['GET'])
@require_admin
def game_leaderboard(game_id):
    from services import game_engine as engine
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return jsonify({"success": False, "message": "Game not found."}), 404
    return jsonify({"success": True,
                    "leaderboard": engine.game_leaderboard(rows[0])}), 200


@admin_api.route('/games/<game_id>/trades', methods=['GET'])
@require_admin
def game_trades(game_id):
    trades = svc.game_trades(game_id)
    if trades is None:
        return jsonify({"success": False, "message": "Game not found."}), 404
    return jsonify({"success": True, "trades": trades}), 200


# ---------------- settings + audit ----------------

@admin_api.route('/settings', methods=['GET'])
@require_admin
def settings_get():
    return jsonify({"success": True, "settings": svc.get_settings()}), 200


@admin_api.route('/settings', methods=['PATCH'])
@require_admin
def settings_update():
    data = request.get_json(silent=True) or {}
    row, err = svc.update_settings(request.admin_user["id"], data)
    if err:
        return jsonify({"success": False, "message": err}), 400
    return jsonify({"success": True, "settings": row}), 200


@admin_api.route('/actions', methods=['GET'])
@require_admin
def actions_list():
    try:
        limit = int(request.args.get("limit", "50"))
    except (ValueError, TypeError):
        limit = 50
    return jsonify({"success": True,
                    "actions": svc.recent_actions(max(1, min(limit, 200)))}), 200

"""Admin business logic (Phases 6, 8-12).

All functions assume the caller already passed require_admin
(401 unauthenticated / 403 non-admin enforced in routes/admin.py).
Role is always determined server-side from the profiles row.

Every mutation writes an admin_actions audit record.
"""

import random
import string
import time
import uuid

from services import game_store as gs
from services.auth_store import (
    create_profile_row,
    find_profile_by_email,
    find_profile_by_id,
    list_profiles,
    update_profile_row,
)
from services.passwords import hash_password

VALID_GAME_STATUSES = ("draft", "waiting", "live", "paused",
                       "market_closed", "completed", "cancelled")
ROUND_STATUSES = ("pending", "question_open", "market_open",
                  "market_closed", "result", "settled")


# ---------------- audit ----------------

def log_action(admin_id, action, entity_type, entity_id=None, metadata=None):
    try:
        return gs.gw_insert("admin_actions", {
            "id": str(uuid.uuid4()),
            "admin_user_id": str(admin_id), "action": str(action),
            "entity_type": str(entity_type),
            "entity_id": str(entity_id) if entity_id is not None else None,
            "metadata": metadata or {},
        })
    except Exception:
        return None


def recent_actions(limit=20):
    rows = gs.gw_select("admin_actions")
    rows.sort(key=lambda r: str(r.get("created_at", "")), reverse=True)
    return rows[:int(limit)]


# ---------------- dashboard ----------------

def dashboard_metrics():
    profiles = list_profiles()
    students = [p for p in profiles if p.get("role") == "participant"]
    active = [p for p in students if (p.get("status") or "active") == "active"]
    disabled = [p for p in students if (p.get("status") or "") in ("disabled", "banned")]
    questions = gs.gw_select("questions")
    active_q = [q for q in questions if q.get("is_active")]
    games = gs.gw_select("games")
    live_games = [g for g in games if g.get("status") in ("live", "market_closed", "paused")]
    current_game = live_games[0] if live_games else None
    players_in_game = 0
    current_round = None
    current_question = None
    leaderboard = []
    if current_game:
        from services import game_engine as engine
        players = gs.gw_select("game_players", {"game_id": str(current_game["id"])})
        players_in_game = len(players)
        leaderboard = engine.game_leaderboard(current_game)[:10]
        rounds = gs.gw_select("rounds", {"game_id": str(current_game["id"])})
        live_rounds = [r for r in rounds if r.get("status") in ("question_open", "market_open")]
        if live_rounds:
            live_rounds.sort(key=lambda r: int(r.get("round_number", 0)), reverse=True)
            current_round = {"round_number": live_rounds[0].get("round_number"),
                             "status": live_rounds[0].get("status")}
            qrow = gs.get_question_row(live_rounds[0].get("question_id"))
            if qrow:
                current_question = gs.sanitize_question(qrow)
    return {
        "total_students": len(students),
        "active_students": len(active),
        "disabled_students": len(disabled),
        "total_questions": len(questions),
        "active_questions": len(active_q),
        "total_games": len(games),
        "active_games": len(live_games),
        "players_in_active_game": players_in_game,
        "current_game": ({"id": current_game.get("id"), "name": current_game.get("name"),
                          "game_pin": current_game.get("game_pin"),
                          "status": current_game.get("status")} if current_game else None),
        "current_round": current_round,
        "current_question": current_question,
        "leaderboard": leaderboard,
        "recent_actions": recent_actions(10),
    }


# ---------------- students ----------------

def _student_aggregates(user_id):
    players = gs.gw_select("game_players", {"user_id": str(user_id)})
    games_played = len(players)
    total_pl = sum(float(p.get("total_profit_loss", 0) or 0) for p in players)
    total_score = sum(int(p.get("score", 0) or 0) for p in players)
    current_game = None
    for p in players:
        g = gs.gw_select("games", {"id": str(p.get("game_id"))}, limit=1)
        if g and g[0].get("status") in ("waiting", "live", "paused", "market_closed"):
            current_game = {"id": g[0]["id"], "name": g[0].get("name"),
                            "game_pin": g[0].get("game_pin")}
            break
    return {"games_played": games_played, "total_pl": total_pl,
            "total_score": total_score, "current_game": current_game}


def list_students(search="", status_filter="", role_filter=""):
    out = []
    for p in list_profiles():
        if search and search.lower() not in (
                str(p.get("name", "")) + " " + str(p.get("email", ""))).lower():
            continue
        if status_filter and (p.get("status") or "active") != status_filter:
            continue
        if role_filter and p.get("role") != role_filter:
            continue
        row = dict(p)
        row.update(_student_aggregates(p["id"]))
        out.append(row)
    return out


def get_student_detail(user_id):
    row = find_profile_by_id(user_id)
    if not row:
        return None
    from services import game_engine as engine
    safe = {"id": row["id"], "name": row.get("name"), "email": row.get("email"),
            "role": row.get("role"), "avatar": row.get("avatar"),
            "status": row.get("status")}
    safe.update(_student_aggregates(row["id"]))
    history = []
    for p in gs.gw_select("game_players", {"user_id": str(row["id"])}):
        g = gs.gw_select("games", {"id": str(p.get("game_id"))}, limit=1)
        g = g[0] if g else {}
        for h in engine.player_history(
                {"id": str(p.get("game_id")),
                 "starting_capital": p.get("starting_capital", 0)}, {"id": str(row["id"])}):
            h = dict(h)
            h["game_name"] = g.get("name", "")
            h["game_pin"] = g.get("game_pin", "")
            history.append(h)
    history.sort(key=lambda h: str(h.get("game_pin", "")))
    safe["history"] = history
    return safe


def admin_create_student(admin_id, data):
    import re as _re
    name = str(data.get("name", "") or "").strip()
    email = str(data.get("email", "") or "").strip().lower()
    password = str(data.get("password", "") or "")
    role = str(data.get("role", "participant") or "participant").strip()
    if role not in ("participant", "admin"):
        return None, "Role must be participant or admin."
    if not name:
        return None, "Name is required."
    if not email or not _re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return None, "Enter a valid email address."
    if len(password) < 8:
        return None, "Password must be at least 8 characters."
    if find_profile_by_email(email):
        return None, "An account with this email already exists."
    row = create_profile_row(name, email, hash_password(password),
                             role=role, avatar=str(data.get("avatar", "🦊") or "🦊"),
                             status="active")
    if not row:
        return None, "Could not create student."
    log_action(admin_id, "student.create", "student", row["id"], {"email": email, "role": role})
    return {"id": row["id"], "name": row["name"], "email": row["email"],
            "role": row["role"], "avatar": row["avatar"], "status": row["status"]}, None


def admin_update_student(admin_id, user_id, data):
    row = find_profile_by_id(user_id)
    if not row:
        return None, "Student not found."
    patch = {}
    if "name" in data and str(data["name"] or "").strip():
        patch["name"] = str(data["name"]).strip()[:100]
    if "role" in data:
        if str(data["role"]) not in ("participant", "admin"):
            return None, "Role must be participant or admin."
        patch["role"] = str(data["role"])
    if "avatar" in data and str(data["avatar"] or "").strip():
        patch["avatar"] = str(data["avatar"]).strip()[:8]
    if "password" in data and str(data["password"] or ""):
        if len(str(data["password"])) < 8:
            return None, "Password must be at least 8 characters."
        patch["password_hash"] = hash_password(str(data["password"]))
    if not patch:
        return None, "Nothing to update."
    updated = update_profile_row(user_id, patch)
    if not updated:
        return None, "Could not update student."
    log_action(admin_id, "student.update", "student", user_id, {"fields": sorted(patch.keys())})
    return {"id": updated["id"], "name": updated.get("name"), "email": updated.get("email"),
            "role": updated.get("role"), "avatar": updated.get("avatar"),
            "status": updated.get("status")}, None


def admin_set_student_status(admin_id, user_id, status):
    if status not in ("active", "disabled", "banned"):
        return None, "Invalid status."
    row = find_profile_by_id(user_id)
    if not row:
        return None, "Student not found."
    updated = update_profile_row(user_id, {"status": status})
    if not updated:
        return None, "Could not update status."
    log_action(admin_id, "student.status.{}".format(status), "student", user_id, {})
    return {"id": updated["id"], "status": status}, None


# ---------------- games ----------------

def _random_pin(length=6):
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def _validate_game_payload(data, partial=False):
    def num(key, lo=None, hi=None, integer=False):
        if partial and key not in data:
            return None, None
        try:
            v = float(data.get(key)) if data.get(key) not in (None, "") else None
        except (ValueError, TypeError):
            return None, "{} must be a number.".format(key)
        if v is None and not partial:
            return None, "{} is required.".format(key)
        if v is None:
            return None, None
        if integer:
            v = int(v)
        if lo is not None and v < lo:
            return None, "{} is too small.".format(key)
        if hi is not None and v > hi:
            return None, "{} is too large.".format(key)
        return v, None

    if not partial or "name" in data:
        if not str(data.get("name", "") or "").strip():
            return None, "Game name is required."
    for key, lo, hi, integer in (("starting_capital", 1, 10000000, False),
                                 ("min_risk", 0, 100, False),
                                 ("max_risk", 0, 100, False),
                                 ("default_question_duration", 5, 300, True)):
        _v, err = num(key, lo, hi, integer)
        if err:
            return None, err
    min_r = data.get("min_risk", None)
    max_r = data.get("max_risk", None)
    if min_r not in (None, "") and max_r not in (None, ""):
        try:
            if float(min_r) > float(max_r):
                return None, "min_risk cannot exceed max_risk."
        except (ValueError, TypeError):
            return None, "Risk values must be numbers."
    return True, None


def list_games():
    games = gs.gw_select("games")
    out = []
    for g in games:
        g = dict(g)
        g["rounds"] = len(gs.gw_select("game_questions", {"game_id": str(g.get("id"))}))
        g["players"] = len(gs.gw_select("game_players", {"game_id": str(g.get("id"))}))
        out.append(g)
    return out


def get_game_detail(game_id):
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return None
    g = dict(rows[0])
    gqs = gs.gw_select("game_questions", {"game_id": str(game_id)})
    gqs.sort(key=lambda r: int(r.get("round_number", 0)))
    g["questions"] = gqs
    g["rounds"] = gs.gw_select("rounds", {"game_id": str(game_id)})
    g["players"] = gs.gw_select("game_players", {"game_id": str(game_id)})
    return g


def _default_settings():
    rows = gs.gw_select("game_settings", limit=1)
    if rows:
        return rows[0]
    return {"default_starting_capital": 10000, "default_min_risk": 10,
            "default_max_risk": 75, "default_question_duration": 15}


def admin_create_game(admin_id, data, creator_id):
    ok, err = _validate_game_payload(data)
    if err:
        return None, err
    pin = str(data.get("game_pin", "") or "").strip().upper() or _random_pin()
    if gs.gw_select("games", {"game_pin": pin}, limit=1):
        return None, "Game PIN already exists."
    settings = _default_settings()
    game = gs.gw_insert("games", {
        "id": str(uuid.uuid4()),
        "game_pin": pin,
        "name": str(data.get("name")).strip()[:120],
        "status": "draft" if str(data.get("status", "draft")) not in VALID_GAME_STATUSES else str(data.get("status", "draft")),
        "starting_capital": float(data.get("starting_capital", settings["default_starting_capital"])),
        "min_risk": float(data.get("min_risk", settings["default_min_risk"])),
        "max_risk": float(data.get("max_risk", settings["default_max_risk"])),
        "default_question_duration": int(data.get("default_question_duration", settings["default_question_duration"])),
        "created_by": str(creator_id),
    })
    qids = data.get("question_ids") or []
    if qids:
        err = set_game_questions(game["id"], qids)
        if err:
            return None, err
    log_action(admin_id, "game.create", "game", game["id"], {"pin": pin, "name": game.get("name")})
    return get_game_detail(game["id"]), None


def set_game_questions(game_id, question_ids):
    """Replace ordered game_questions. Returns error string or None."""
    seen, ordered = set(), []
    for q in question_ids or []:
        qid = gs.qid_str(q)
        if not qid or qid in seen:
            continue
        if not gs.get_question_row(qid):
            return "Question not found: {}".format(qid)
        seen.add(qid)
        ordered.append(qid)
    for r in gs.gw_select("game_questions", {"game_id": str(game_id)}):
        gs.gw_delete("game_questions", {"id": str(r.get("id"))})
    for i, qid in enumerate(ordered, start=1):
        qrow = gs.get_question_row(qid)
        gs.gw_insert("game_questions", {
            "id": str(uuid.uuid4()), "game_id": str(game_id),
            "question_id": qid, "round_number": i,
            "duration_seconds": qrow.get("duration_seconds", 15),
        })
    return None


def admin_update_game(admin_id, game_id, data):
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return None, "Game not found."
    game = rows[0]
    if str(game.get("status")) not in ("draft", "waiting"):
        # Locked once started: only name may change.
        patch = {}
        if "name" in data and str(data["name"] or "").strip():
            patch["name"] = str(data["name"]).strip()[:120]
        if not patch:
            return None, "Game configuration is locked once the game has started."
        gs.gw_update("games", {"id": str(game_id)}, patch)
        log_action(admin_id, "game.update", "game", game_id, {"fields": ["name"]})
        return get_game_detail(game_id), None
    ok, err = _validate_game_payload(data, partial=True)
    if err:
        return None, err
    patch = {}
    if "name" in data and str(data["name"] or "").strip():
        patch["name"] = str(data["name"]).strip()[:120]
    for key in ("starting_capital", "min_risk", "max_risk"):
        if key in data and data[key] not in (None, ""):
            patch[key] = float(data[key])
    if "default_question_duration" in data and data["default_question_duration"] not in (None, ""):
        patch["default_question_duration"] = int(data["default_question_duration"])
    if "status" in data:
        if str(data["status"]) not in ("draft", "waiting"):
            return None, "Status transition not allowed here."
        patch["status"] = str(data["status"])
    if "question_ids" in data:
        err = set_game_questions(game_id, data["question_ids"])
        if err:
            return None, err
    if patch:
        gs.gw_update("games", {"id": str(game_id)}, patch)
    log_action(admin_id, "game.update", "game", game_id, {"fields": sorted(patch.keys())})
    return get_game_detail(game_id), None


def admin_delete_game(admin_id, game_id):
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return False, "Game not found."
    game = rows[0]
    has_history = (gs.gw_select("answers", {"game_id": str(game_id)}, limit=1)
                   or gs.gw_select("rounds", {"game_id": str(game_id)}, limit=1))
    if has_history and str(game.get("status")) not in ("draft", "cancelled"):
        return False, "Game has historical results. Cancel it instead of deleting."
    for t in ("answers", "positions", "transactions", "rounds",
              "game_questions", "game_players", "leaderboard_snapshots"):
        for r in gs.gw_select(t, {"game_id": str(game_id)}):
            gs.gw_delete(t, {"id": str(r.get("id"))})
    gs.gw_delete("games", {"id": str(game_id)})
    log_action(admin_id, "game.delete", "game", game_id, {"pin": game.get("game_pin")})
    return True, None


# ---------------- live control ----------------

def _current_round_row(game_id):
    rounds = gs.gw_select("rounds", {"game_id": str(game_id)})
    live = [r for r in rounds if r.get("status") in ("question_open", "market_open")]
    if live:
        live.sort(key=lambda r: int(r.get("round_number", 0)), reverse=True)
        return live[0]
    if rounds:
        rounds.sort(key=lambda r: int(r.get("round_number", 0)), reverse=True)
        return rounds[0]
    return None


def _transition(game_id, to_status, allowed_from):
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return None, "Game not found."
    game = rows[0]
    if str(game.get("status")) not in allowed_from:
        return None, "Invalid transition from '{}'.".format(game.get("status"))
    gs.gw_update("games", {"id": str(game_id)}, {"status": to_status})
    return gs.gw_select("games", {"id": str(game_id)}, limit=1)[0], None


def _total_rounds(game_id):
    return len(gs.gw_select("game_questions", {"game_id": str(game_id)}))


def game_control(admin_id, game_id, op):
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    if not rows:
        return None, "Game not found."
    game = rows[0]
    status = str(game.get("status"))
    # ISO-8601 UTC for timestamptz columns (PostgREST rejects epochs).
    now = gs.utcnow_iso()

    if op == "start":
        if status not in ("draft", "waiting"):
            return None, "Only draft/waiting games can be started."
        if not _total_rounds(game_id):
            return None, "Add questions to the game before starting."
        gs.gw_update("games", {"id": str(game_id)}, {"status": "live"})
        # Pre-open round 1.
        from services import game_engine as engine
        engine.ensure_round(gs.gw_select("games", {"id": str(game_id)}, limit=1)[0], 1)
        log_action(admin_id, "game.start", "game", game_id, {})
        return get_game_detail(game_id), None

    if op == "pause":
        game, err = _transition(game_id, "paused", ("live",))
        if err:
            return None, err
    elif op == "resume":
        game, err = _transition(game_id, "live", ("paused",))
        if err:
            return None, err
    elif op == "end":
        game, err = _transition(game_id, "completed", ("live", "paused", "market_closed"))
        if err:
            return None, err
        for p in gs.gw_select("game_players", {"game_id": str(game_id)}):
            gs.gw_update("game_players", {"id": str(p.get("id"))},
                         {"status": "finished"})
    elif op == "cancel":
        game, err = _transition(game_id, "cancelled",
                               ("draft", "waiting", "live", "paused", "market_closed"))
        if err:
            return None, err
    elif op in ("open-question", "close-market", "reveal", "settle", "next"):
        if status not in ("live", "paused", "market_closed"):
            return None, "Game is not live."
        rnd = _current_round_row(game_id)
        if op == "open-question":
            if rnd and rnd.get("status") in ("question_open", "market_open"):
                return None, "A round is already open."
            nxt = (int(rnd.get("round_number", 0)) + 1) if rnd else 1
            if nxt > _total_rounds(game_id):
                return None, "No more rounds to open."
            gqs = {int(g.get("round_number", 0)): g
                   for g in gs.gw_select("game_questions", {"game_id": str(game_id)})}
            gq = gqs.get(nxt)
            gs.gw_insert("rounds", {
                "id": str(uuid.uuid4()), "game_id": str(game_id),
                "round_number": nxt, "question_id": str(gq.get("question_id")),
                "status": "question_open", "started_at": now})
        elif op == "close-market":
            if not rnd or rnd.get("status") not in ("question_open", "market_open"):
                return None, "No open market to close."
            gs.gw_update("rounds", {"id": str(rnd.get("id"))},
                         {"status": "market_closed", "market_closed_at": now})
        elif op == "reveal":
            if not rnd:
                return None, "No round to reveal."
            gs.gw_update("rounds", {"id": str(rnd.get("id"))},
                         {"status": "result", "answer_revealed_at": now})
        elif op == "settle":
            if not rnd:
                return None, "No round to settle."
            gs.gw_update("rounds", {"id": str(rnd.get("id"))},
                         {"status": "settled", "settled_at": now})
        elif op == "next":
            nxt = (int(rnd.get("round_number", 0)) + 1) if rnd else 1
            if nxt > _total_rounds(game_id):
                return None, "No more rounds."
            gqs = {int(g.get("round_number", 0)): g
                   for g in gs.gw_select("game_questions", {"game_id": str(game_id)})}
            gq = gqs.get(nxt)
            if not gq:
                return None, "Round configuration missing."
            gs.gw_insert("rounds", {
                "id": str(uuid.uuid4()), "game_id": str(game_id),
                "round_number": nxt, "question_id": str(gq.get("question_id")),
                "status": "question_open", "started_at": now})
    else:
        return None, "Unknown control operation."

    log_action(admin_id, "game.{}".format(op), "game", game_id, {})
    return get_game_detail(game_id), None


# ---------------- trades (admin history view) ----------------

def game_trades(game_id):
    """Every recorded answer/position in a game with player + question info."""
    from services import game_engine as engine
    game_id = str(game_id)
    games = gs.gw_select("games", {"id": game_id}, limit=1)
    if not games:
        return None
    rounds = {str(r.get("id")): r for r in gs.gw_select("rounds", {"game_id": game_id})}
    players = {str(p.get("user_id")): p for p in gs.gw_select("game_players", {"game_id": game_id})}
    out = []
    for a in gs.gw_select("answers", {"game_id": game_id}):
        rnd = rounds.get(str(a.get("round_id")))
        if not rnd:
            continue
        qrow = gs.get_question_row(rnd.get("question_id")) or {}
        pos = next((p for p in gs.gw_select("positions", {"game_id": game_id})
                    if str(p.get("round_id")) == str(rnd.get("id"))
                    and str(p.get("user_id")) == str(a.get("user_id"))), {})
        view = engine._position_view(game_id, str(a.get("user_id")), str(rnd.get("id")), pos)
        prof = find_profile_by_id(a.get("user_id", ""))
        out.append({"round_number": int(rnd.get("round_number", 0)),
                    "player_name": (prof or {}).get("name", str(a.get("user_id"))),
                    "question_text": qrow.get("question_text", ""),
                    "selected_option": a.get("selected_option", ""),
                    "is_correct": bool(a.get("is_correct", False)),
                    "timed_out": bool(a.get("timed_out", False)),
                    "risk_percent": float(pos.get("risk_percent", 0) or 0),
                    "bid_amount": float(pos.get("bid_amount", 0) or 0),
                    "profit_loss": float(pos.get("profit_loss", 0) or 0),
                    "financial_change": view["financial_change"],
                    "capital_after": view["capital_after"]})
    out.sort(key=lambda t: (t["round_number"], t["player_name"]))
    return out


# ---------------- settings ----------------
def get_settings():
    rows = gs.gw_select("game_settings", limit=1)
    return rows[0] if rows else _default_settings()


def update_settings(admin_id, data):
    patch = {}
    mapping = {"default_starting_capital": (1, 10000000),
               "default_min_risk": (0, 100), "default_max_risk": (0, 100),
               "default_question_duration": (5, 300),
               "default_profit_multiplier": (0.1, 100),
               "default_loss_multiplier": (0.1, 100)}
    for key, (lo, hi) in mapping.items():
        if key in data and data[key] not in (None, ""):
            try:
                v = float(data[key])
            except (ValueError, TypeError):
                return None, "{} must be a number.".format(key)
            if not (lo <= v <= hi):
                return None, "{} out of range.".format(key)
            patch[key] = v
    if not patch:
        return None, "Nothing to update."
    rows = gs.gw_select("game_settings", limit=1)
    if not rows:
        base = {"id": str(uuid.uuid4()), "default_starting_capital": 10000,
                "default_min_risk": 10, "default_max_risk": 75,
                "default_question_duration": 15,
                "default_profit_multiplier": 1.0, "default_loss_multiplier": 1.0}
        base.update(patch)
        gs.gw_insert("game_settings", base)
    else:
        gs.gw_update("game_settings", {"id": str(rows[0].get("id"))}, patch)
    log_action(admin_id, "settings.update", "settings", None, {"fields": sorted(patch.keys())})
    return get_settings(), None

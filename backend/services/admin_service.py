"""Admin business logic (Phases 6, 8-12).

All functions assume the caller already passed require_admin
(401 unauthenticated / 403 non-admin enforced in routes/admin.py).
Role is always determined server-side from the profiles row.

Every mutation writes an admin_actions audit record.
"""

import random
import string
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
    return gs.gw_select("admin_actions", limit=int(limit), order=("created_at", True))


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


def control_deck_state(game_id=None):
    """Full operational state for the live Admin Control Deck."""
    from services import game_engine as engine

    games = gs.gw_select("games")
    games.sort(key=lambda g: str(g.get("created_at", "")), reverse=True)

    target_game = None
    if game_id:
        rows = [g for g in games if str(g.get("id")) == str(game_id)]
        if rows:
            target_game = rows[0]

    if not target_game:
        # Prioritize live / active games so games in progress never disappear
        live = [g for g in games if g.get("status") in ("live", "paused", "market_closed")]
        if live:
            target_game = live[0]
        else:
            waiting = [g for g in games if g.get("status") in ("waiting", "draft")]
            if waiting:
                target_game = waiting[0]
            elif games:
                target_game = games[0]

    profiles = list_profiles()
    profiles_dict = {str(p.get("id")): p for p in profiles}
    students = [p for p in profiles if p.get("role") == "participant"]
    all_questions = gs.gw_select("questions")

    games_summary = [
        {
            "id": str(g["id"]),
            "name": str(g.get("name", "")),
            "game_pin": str(g.get("game_pin", "")),
            "status": str(g.get("status", "draft")),
        }
        for g in games
    ]

    if not target_game:
        return {
            "has_game": False,
            "total_students": len(students),
            "total_questions": len(all_questions),
            "total_games": len(games),
            "recent_actions": recent_actions(25),
            "games_list": games_summary,
        }

    gid = str(target_game["id"])
    gqs = gs.gw_select("game_questions", {"game_id": gid})
    gqs.sort(key=lambda r: int(r.get("round_number", 0)))
    total_rounds = len(gqs)

    rounds = gs.gw_select("rounds", {"game_id": gid})
    rounds.sort(key=lambda r: int(r.get("round_number", 0)))

    current_round = None
    active_rounds = [r for r in rounds if r.get("status") in ("question_open", "market_open")]
    if active_rounds:
        active_rounds.sort(key=lambda r: int(r.get("round_number", 0)), reverse=True)
        current_round = active_rounds[0]
    elif rounds:
        current_round = rounds[-1]

    current_question = None
    if current_round:
        qrow = gs.get_question_row(current_round.get("question_id"))
        if qrow:
            current_question = {
                "id": str(qrow.get("id")),
                "question_text": qrow.get("question_text", ""),
                "option_a": qrow.get("option_a", ""),
                "option_b": qrow.get("option_b", ""),
                "option_c": qrow.get("option_c", ""),
                "option_d": qrow.get("option_d", ""),
                "correct_option": qrow.get("correct_option", ""),
                "explanation": qrow.get("explanation", ""),
                "category": qrow.get("category", "Market Intelligence"),
                "duration_seconds": int(qrow.get("duration_seconds", 15) or 15),
                "round_number": int(current_round.get("round_number", 1)),
                "round_status": str(current_round.get("status", "question_open")),
            }

    players_rows = gs.gw_select("game_players", {"game_id": gid})
    players_list = []
    current_round_answers = {}
    current_round_positions = {}

    if current_round:
        rid = str(current_round["id"])
        ans_rows = gs.gw_select("answers", {"game_id": gid, "round_id": rid})
        for a in ans_rows:
            current_round_answers[str(a.get("user_id"))] = a
        pos_rows = gs.gw_select("positions", {"game_id": gid, "round_id": rid})
        for p in pos_rows:
            current_round_positions[str(p.get("user_id"))] = p

    total_capital_at_risk = 0.0
    sentiment_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    sentiment_capital = {"A": 0.0, "B": 0.0, "C": 0.0, "D": 0.0}

    for p in players_rows:
        uid = str(p.get("user_id"))
        prof = profiles_dict.get(uid) or {}
        ans = current_round_answers.get(uid)
        pos = current_round_positions.get(uid)

        sub_info = None
        if ans:
            opt = str(ans.get("selected_option", "")).strip().upper()
            if opt in sentiment_counts:
                sentiment_counts[opt] += 1
            bid = float(pos.get("bid_amount", 0) or 0) if pos else 0.0
            if opt in sentiment_capital:
                sentiment_capital[opt] += bid
            total_capital_at_risk += bid

            sub_info = {
                "selected_option": ans.get("selected_option"),
                "risk_percent": float(pos.get("risk_percent", 0) or 0) if pos else 0.0,
                "bid_amount": bid,
                "potential_profit": float(pos.get("potential_profit", 0) or 0) if pos else 0.0,
                "potential_loss": float(pos.get("potential_loss", 0) or 0) if pos else 0.0,
                "is_correct": ans.get("is_correct"),
                "submitted_at": ans.get("answered_at") or ans.get("created_at"),
                "status": "settled" if current_round and current_round.get("status") == "settled" else (
                    "locked" if current_round and current_round.get("status") in ("market_closed", "result") else "submitted"
                ),
            }

        players_list.append({
            "user_id": uid,
            "name": prof.get("name", "Student"),
            "email": prof.get("email", ""),
            "avatar": prof.get("avatar", "🦊"),
            "current_capital": float(p.get("current_capital", 0) or 0),
            "total_profit_loss": float(p.get("total_profit_loss", 0) or 0),
            "score": int(p.get("score", 0) or 0),
            "status": str(p.get("status", "active")),
            "submission": sub_info,
        })

    submitted_count = len(current_round_answers)
    total_joined = len(players_rows)
    waiting_count = max(0, total_joined - submitted_count)

    sentiment_percentages = {}
    for k, v in sentiment_counts.items():
        sentiment_percentages[k] = round((v / submitted_count * 100), 1) if submitted_count > 0 else 0.0

    trades = game_trades(gid) or []
    leaderboard = engine.game_leaderboard(target_game)

    biggest_gainer = None
    biggest_drawdown = None
    high_conviction = []

    if trades:
        settled_trades = [t for t in trades if t.get("profit_loss") is not None]
        if settled_trades:
            gainers = sorted(settled_trades, key=lambda t: float(t.get("profit_loss", 0)), reverse=True)
            if gainers and float(gainers[0].get("profit_loss", 0)) > 0:
                biggest_gainer = gainers[0]
            losers = sorted(settled_trades, key=lambda t: float(t.get("profit_loss", 0)))
            if losers and float(losers[0].get("profit_loss", 0)) < 0:
                biggest_drawdown = losers[0]
        conviction_sorted = sorted(trades, key=lambda t: (float(t.get("risk_percent", 0)), float(t.get("bid_amount", 0))), reverse=True)
        high_conviction = conviction_sorted[:5]

    return {
        "has_game": True,
        "game": {
            "id": gid,
            "name": str(target_game.get("name", "")),
            "game_pin": str(target_game.get("game_pin", "")),
            "status": str(target_game.get("status", "draft")),
            "starting_capital": float(target_game.get("starting_capital", 10000) or 10000),
            "min_risk": float(target_game.get("min_risk", 10) or 10),
            "max_risk": float(target_game.get("max_risk", 75) or 75),
            "default_question_duration": int(target_game.get("default_question_duration", 15) or 15),
            "total_rounds": total_rounds,
            "current_round_number": int(current_round.get("round_number", 1)) if current_round else 1,
            "round_status": str(current_round.get("status", "pending")) if current_round else "pending",
            "round_id": str(current_round.get("id")) if current_round else None,
            "round_started_at": current_round.get("started_at") if current_round else None,
            "questions": gqs,
        },
        "current_question": current_question,
        "participants": {
            "total_joined": total_joined,
            "submitted_count": submitted_count,
            "waiting_count": waiting_count,
            "list": players_list,
        },
        "sentiment": {
            "counts": sentiment_counts,
            "percentages": sentiment_percentages,
            "capital_by_option": sentiment_capital,
            "total_capital_at_risk": total_capital_at_risk,
            "total_submissions": submitted_count,
        },
        "movers": {
            "biggest_gainer": biggest_gainer,
            "biggest_drawdown": biggest_drawdown,
            "high_conviction": high_conviction,
        },
        "leaderboard": leaderboard,
        "recent_trades": trades[-30:] if trades else [],
        "recent_actions": recent_actions(25),
        "games_list": games_summary,
        "total_students": len(students),
        "total_questions": len(all_questions),
        "total_games": len(games),
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
    profiles = list_profiles()
    filtered = []
    for p in profiles:
        if search and search.lower() not in (
                str(p.get("name", "")) + " " + str(p.get("email", ""))).lower():
            continue
        if status_filter and (p.get("status") or "active") != status_filter:
            continue
        if role_filter and p.get("role") != role_filter:
            continue
        filtered.append(dict(p))

    if not filtered:
        return []

    # Batch fetch all game_players and active games in just 2 queries total
    all_players = gs.gw_select("game_players")
    all_games = gs.gw_select("games")
    games_by_id = {str(g["id"]): g for g in all_games}

    # Group players by user_id
    players_by_user = {}
    for p in all_players:
        uid = str(p.get("user_id", ""))
        if uid not in players_by_user:
            players_by_user[uid] = []
        players_by_user[uid].append(p)

    out = []
    for p in filtered:
        uid = str(p["id"])
        user_players = players_by_user.get(uid, [])
        games_played = len(user_players)
        total_pl = sum(float(pl.get("total_profit_loss", 0) or 0) for pl in user_players)
        total_score = sum(int(pl.get("score", 0) or 0) for pl in user_players)
        current_game = None
        for pl in user_players:
            g = games_by_id.get(str(pl.get("game_id")))
            if g and g.get("status") in ("waiting", "live", "paused", "market_closed"):
                current_game = {"id": g["id"], "name": g.get("name"),
                                "game_pin": g.get("game_pin")}
                break
        p.update({
            "games_played": games_played,
            "total_pl": total_pl,
            "total_score": total_score,
            "current_game": current_game,
        })
        out.append(p)
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

    user_players = gs.gw_select("game_players", {"user_id": str(row["id"])})
    if not user_players:
        safe["history"] = []
        return safe

    all_games = {str(g["id"]): g for g in gs.gw_select("games")}
    history = []
    for p in user_players:
        g = all_games.get(str(p.get("game_id")), {})
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
    if not games:
        return []
    all_gqs = gs.gw_select("game_questions")
    all_gps = gs.gw_select("game_players")

    rounds_count = {}
    for gq in all_gqs:
        gid = str(gq.get("game_id", ""))
        rounds_count[gid] = rounds_count.get(gid, 0) + 1

    players_count = {}
    for gp in all_gps:
        gid = str(gp.get("game_id", ""))
        players_count[gid] = players_count.get(gid, 0) + 1

    out = []
    for g in games:
        g = dict(g)
        gid = str(g.get("id", ""))
        g["rounds"] = rounds_count.get(gid, 0)
        g["players"] = players_count.get(gid, 0)
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
            gs.gw_delete("games", {"id": game["id"]})
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
        seen.add(qid)
        ordered.append(qid)

    all_q_rows = {str(q.get("id")): q for q in gs.gw_select("questions")}
    for qid in ordered:
        if qid not in all_q_rows:
            direct_q = gs.get_question_row(qid) or gs.gw_select("questions", {"id": qid}, limit=1)
            if direct_q:
                all_q_rows[qid] = direct_q[0] if isinstance(direct_q, list) else direct_q
            else:
                return "Question not found: {}".format(qid)

    for r in gs.gw_select("game_questions", {"game_id": str(game_id)}):
        gs.gw_delete("game_questions", {"id": str(r.get("id"))})

    for i, qid in enumerate(ordered, start=1):
        qrow = all_q_rows[qid]
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
        gs.gw_delete(t, {"game_id": str(game_id)})
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
        engine.ensure_round(gs.gw_select("games", {"id": str(game_id)}, limit=1)[0], 1, create=True)
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
        game, err = _transition(game_id, "completed",
                               ("draft", "waiting", "live", "paused", "market_closed", "settled"))
        if err:
            return None, err
        gs.gw_update("game_players", {"game_id": str(game_id)}, {"status": "finished"})
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
            try:
                from services import game_engine as engine
                players = gs.gw_select("game_players", {"game_id": str(game_id)})
                existing_answers = {str(a.get("user_id")) for a in gs.gw_select("answers", {"round_id": str(rnd.get("id"))})}
                for p in players:
                    p_uid = str(p.get("user_id"))
                    if p_uid not in existing_answers:
                        prof = {"id": p_uid, "name": "Student"}
                        engine.timeout_round(game, prof, rnd)
            except Exception:
                pass
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
    answers = gs.gw_select("answers", {"game_id": game_id})
    if not answers:
        return []

    positions = gs.gw_select("positions", {"game_id": game_id})
    pos_lookup = {(str(p.get("round_id")), str(p.get("user_id"))): p for p in positions}

    all_q_rows = {str(q.get("id")): q for q in gs.gw_select("questions")}
    all_profiles = {str(p.get("id")): p for p in list_profiles()}

    out = []
    for a in answers:
        rnd = rounds.get(str(a.get("round_id")))
        if not rnd:
            continue
        qid = str(rnd.get("question_id", ""))
        qrow = all_q_rows.get(qid, {})
        uid = str(a.get("user_id", ""))
        pos = pos_lookup.get((str(rnd.get("id")), uid), {})
        view = engine._position_view(game_id, uid, str(rnd.get("id")), pos)
        prof = all_profiles.get(uid)
        out.append({"round_number": int(rnd.get("round_number", 0)),
                    "player_name": (prof or {}).get("name", uid),
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

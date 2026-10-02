"""Authoritative game engine (Phase 4).

Persistent game state lives in Supabase (or the local fallback store):
games, game_questions, rounds, game_players, answers, positions,
transactions. Flask session identifies the user + active game only.

Economics (preserved from the original engine):
- correct + multiplier 0 -> +100 flat; else +bid*multiplier; score+1
- wrong   + multiplier 0 ->  0 change; else -bid
- timeout -> no capital change

Risk input: prefers `risk_percent` (validated against the game's
min/max); legacy `risk_multiplier` + `bid_amount` still accepted and
re-validated server-side. Frontend values are never trusted.
"""

import time
import uuid

from flask import session

from services import game_store as gs
from services.auth_store import find_profile_by_email, find_profile_by_id
from services.questions_service import validate_player_answer
from services.verify_token import verify_token

JOINABLE_STATUSES = ("waiting", "live")
PLAYABLE_ROUND_STATUSES = ("question_open", "market_open")
RISK_TIERS = ((25, 2), (50, 3), (101, 5))


def _now():
    return time.time()


# ---------------- identity ----------------

def current_identity():
    """Resolve the authenticated user from Bearer token or session."""
    from flask import request
    auth = request.headers.get("Authorization", "") if request else ""
    if auth.startswith("Bearer "):
        payload = verify_token(auth.split(" ", 1)[1].strip())
        if payload:
            row = find_profile_by_id(payload.get("sub", ""))
            if row and (row.get("status") or "active").lower() == "active":
                return {"id": row["id"], "name": row.get("name", ""),
                        "email": row.get("email", ""), "role": row.get("role", "participant"),
                        "avatar": row.get("avatar", "🦊")}
            if payload.get("name"):
                return {"id": payload.get("sub", ""), "name": payload.get("name", ""),
                        "email": payload.get("email", ""), "role": payload.get("role", "participant"),
                        "avatar": "🦊"}
    uid = session.get("user_id")
    if uid:
        row = find_profile_by_id(uid)
        if row and (row.get("status") or "active").lower() == "active":
            return {"id": row["id"], "name": row.get("name", ""),
                    "email": row.get("email", ""), "role": row.get("role", "participant"),
                    "avatar": session.get("avatar", row.get("avatar", "🦊"))}
        if session.get("player_name"):
            return {"id": str(uid), "name": session.get("player_name", ""),
                    "email": session.get("email", ""), "role": session.get("role", "participant"),
                    "avatar": session.get("avatar", "🦊")}
    return None


# ---------------- games ----------------

def get_game_by_pin(pin):
    pin = str(pin or "").strip().upper()
    if not pin:
        return None
    rows = gs.gw_select("games", {"game_pin": pin}, limit=1)
    if rows:
        return rows[0]
    for r in gs.gw_select("games"):
        if str(r.get("game_pin", "")).strip().upper() == pin:
            return r
    return None


def get_game(game_id):
    rows = gs.gw_select("games", {"id": str(game_id)}, limit=1)
    return rows[0] if rows else None


def game_rounds(game_id):
    rows = gs.gw_select("game_questions", {"game_id": str(game_id)})
    rows.sort(key=lambda r: r.get("round_number", 0))
    return rows


# ---------------- players ----------------

def get_player(game_id, user_id):
    rows = gs.gw_select("game_players", {"game_id": str(game_id), "user_id": str(user_id)}, limit=1)
    return rows[0] if rows else None


def _record_tx(game_id, user_id, round_id, tx_type, amount, balance_after):
    try:
        amount = float(amount)
    except (ValueError, TypeError):
        amount = 0
    return gs.gw_insert("transactions", {
        "id": str(uuid.uuid4()),
        "game_id": str(game_id), "user_id": str(user_id),
        "round_id": round_id,
        "type": tx_type, "amount": amount, "balance_after": float(balance_after),
    })


def ensure_player(game, user):
    player = get_player(game["id"], user["id"])
    if player:
        return player
    starting = float(game.get("starting_capital", 1000))
    player = gs.gw_insert("game_players", {
        "id": str(uuid.uuid4()),
        "game_id": str(game["id"]), "user_id": str(user["id"]),
        "current_capital": starting, "starting_capital": starting,
        "total_profit_loss": 0, "score": 0, "status": "active",
    })
    _record_tx(game["id"], user["id"], None, "starting_capital", starting, starting)
    return player


# ---------------- rounds ----------------

def ensure_round(game, round_number):
    """Get or open the round row for (game, n). Creates it for live games."""
    game_id = str(game["id"])
    rows = gs.gw_select("rounds", {"game_id": game_id, "round_number": int(round_number)}, limit=1)
    if rows:
        return rows[0]
    gqs = game_rounds(game_id)
    gq = next((g for g in gqs if int(g.get("round_number", 0)) == int(round_number)), None)
    if not gq:
        return None
    duration = gq.get("duration_seconds") or game.get("default_question_duration", 15)
    return gs.gw_insert("rounds", {
        "id": str(uuid.uuid4()),
        "game_id": game_id, "round_number": int(round_number),
        "question_id": str(gq.get("question_id")),
        "status": "question_open", "started_at": gs.utcnow_iso(),
    })


def player_answered_rounds(game_id, user_id):
    game_id, user_id = str(game_id), str(user_id)
    rounds = gs.gw_select("rounds", {"game_id": game_id})
    by_id = {str(r.get("id")): r for r in rounds}
    answered = set()
    for a in gs.gw_select("answers", {"game_id": game_id, "user_id": user_id}):
        r = by_id.get(str(a.get("round_id")))
        if r:
            answered.add(int(r.get("round_number", 0)))
    for p in gs.gw_select("positions", {"game_id": game_id, "user_id": user_id}):
        r = by_id.get(str(p.get("round_id")))
        if r:
            answered.add(int(r.get("round_number", 0)))
    return answered


def player_current_round_number(game, user):
    total = len(game_rounds(str(game["id"])))
    answered = player_answered_rounds(str(game["id"]), str(user["id"]))
    n = 1
    while n in answered:
        n += 1
    if n > total:
        return None  # completed
    return n


def _round_deadline(game, gq_duration, round_row):
    duration = (gq_duration or game.get("default_question_duration", 15)) or 15
    started = gs.to_epoch(round_row.get("started_at"))
    return started + int(duration), int(duration)


# ---------------- public state ----------------

def _player_payload(user, player, avatar):
    return {"name": user.get("name", ""),
            "avatar": avatar or user.get("avatar", "🦊"),
            "capital": float(player.get("current_capital", 0)),
            "score": int(player.get("score", 0))}


def build_current_state(game, user, avatar="🦊"):
    """Build the /game/current response (authoritative, sanitized)."""
    player = ensure_player(game, user)
    if str(game.get("status")) not in ("live", "market_closed", "paused"):
        if str(game.get("status")) == "waiting":
            return {"success": True, "game_state": "waiting",
                    "player": _player_payload(user, player, avatar),
                    "game_code": game.get("game_pin"),
                    "message": "Waiting for the admin to start the game."}
        if str(game.get("status")) in ("completed", "cancelled"):
            return _gameover(game, user, player, avatar,
                             reason="completed" if game.get("status") == "completed" else "cancelled")
        return {"success": True, "game_state": "waiting",
                "player": _player_payload(user, player, avatar),
                "game_code": game.get("game_pin"),
                "message": "Game is not live yet (status: {}).".format(game.get("status"))}

    capital = float(player.get("current_capital", 0))
    if capital <= 0:
        return _gameover(game, user, player, avatar, reason="bankrupt")

    n = player_current_round_number(game, user)
    total = len(game_rounds(str(game["id"])))
    if n is None:
        return _gameover(game, user, player, avatar, reason="completed")

    round_row = ensure_round(game, n)
    if not round_row:
        return _gameover(game, user, player, avatar, reason="completed")

    if str(round_row.get("status")) == "market_closed":
        return {"success": True, "game_state": "waiting",
                "player": _player_payload(user, player, avatar),
                "game_code": game.get("game_pin"),
                "message": "Market is closed for this round. Waiting for results."}

    gqs = {int(g.get("round_number", 0)): g for g in game_rounds(str(game["id"]))}
    gq = gqs.get(int(n), {})
    deadline, duration = _round_deadline(game, gq.get("duration_seconds"), round_row)
    now = _now()
    if now >= deadline:
        # Auto-close: treat as timed out for this player, then show result.
        timeout_round(game, user, round_row)
        return build_result_state(game, user, avatar)

    from services.game_store import get_question_row
    qrow = get_question_row(round_row.get("question_id"))
    if not qrow or not qrow.get("is_active", True):
        return {"success": False, "game_state": "question",
                "message": "Question unavailable."}
    from services.game_store import sanitize_question
    client_q = sanitize_question(qrow)
    return {"success": True, "game_state": "question",
            "player": _player_payload(user, player, avatar),
            "game_code": game.get("game_pin"),
            "round": {"index": int(n) - 1, "current_number": int(n),
                      "total_questions": total, "question": client_q,
                      "deadline": deadline, "time_remaining": max(0, int(deadline - now)),
                      "server_time": now}}


def _gameover(game, user, player, avatar, reason="completed"):
    starting = float(player.get("starting_capital", game.get("starting_capital", 1000)))
    capital = float(player.get("current_capital", 0))
    total = len(game_rounds(str(game["id"])))
    return {"success": True, "game_state": "gameover", "reason": reason,
            "player": _player_payload(user, player, avatar),
            "summary": {"starting_capital": starting, "final_capital": capital,
                        "net_pl": capital - starting,
                        "score": int(player.get("score", 0)), "total_questions": total}}


def build_result_state(game, user, avatar="🦊"):
    player = ensure_player(game, user)
    total = len(game_rounds(str(game["id"])))
    last = latest_player_result(str(game["id"]), str(user["id"]))
    if not last:
        return {"success": False, "message": "No result available for current round."}, 404
    n = int(last.get("round_number", 1))
    return {"success": True, "result": last.get("result"),
            "capital": float(player.get("current_capital", 0)),
            "score": int(player.get("score", 0)),
            "round_info": {"current_number": n, "total_questions": total,
                           "is_last_question": n >= total,
                           "score": int(player.get("score", 0)),
                           "capital": float(player.get("current_capital", 0))}}, 200


def latest_player_result(game_id, user_id):
    """Most recent settled answer for the player (with full question info)."""
    from services.game_store import get_question_row
    rounds = {str(r.get("id")): r for r in gs.gw_select("rounds", {"game_id": str(game_id)})}
    answers = gs.gw_select("answers", {"game_id": str(game_id), "user_id": str(user_id)})
    positions = gs.gw_select("positions", {"game_id": str(game_id), "user_id": str(user_id)})
    pos_by_round = {str(p.get("round_id")): p for p in positions}
    best = None
    for a in answers:
        r = rounds.get(str(a.get("round_id")))
        if not r:
            continue
        key = int(r.get("round_number", 0))
        if best is None or key > best[0]:
            best = (key, a, r)
    if not best:
        return None
    n, ans, rnd = best
    qrow = get_question_row(rnd.get("question_id")) or {}
    pos = pos_by_round.get(str(rnd.get("id")), {})
    view = _position_view(str(game_id), str(user_id), str(rnd.get("id")), pos)
    return {"round_number": n,
            "result": {"valid": True, "is_correct": bool(ans.get("is_correct", False)),
                       "is_timeout": bool(ans.get("timed_out", False)),
                       "user_answer": ans.get("selected_option", ""),
                       "correct_answer": str(qrow.get("correct_option", "")),
                       "explanation": str(qrow.get("explanation", "") or ""),
                       "financial_change": view["financial_change"],
                       "delta": view["delta"],
                       "previous_capital": view["previous_capital"],
                       "new_capital": view["capital_after"],
                       "selected_risk": view["risk_label"],
                       "risk_multiplier": pos.get("multiplier", 0),
                       "bid_amount": float(pos.get("bid_amount", 0) or 0)}}


def _position_view(game_id, user_id, round_id, pos):
    """Derive display fields for a position from schema columns + its tx.

    Only uses real schema columns, so this works on Supabase and locally.
    """
    pos = pos or {}
    multiplier = pos.get("multiplier", 0) or 0
    try:
        multiplier = int(multiplier)
    except (ValueError, TypeError):
        multiplier = 0
    try:
        risk_percent = float(pos.get("risk_percent", 0) or 0)
    except (ValueError, TypeError):
        risk_percent = 0
    risk_label = ("{}% ({}X)".format(risk_percent, multiplier)
                  if multiplier else "NO RISK")
    if str(pos.get("result", "")) == "timeout":
        risk_label = "None"
    # Find the settlement tx for this round to recover capital movement.
    txs = gs.gw_select("transactions", {"game_id": str(game_id),
                                        "user_id": str(user_id),
                                        "round_id": str(round_id)})
    settle = next((t for t in txs if t.get("type") in ("profit", "loss")), None)
    if settle is not None:
        try:
            amount = float(settle.get("amount", 0) or 0)
        except (ValueError, TypeError):
            amount = 0
        try:
            after = float(settle.get("balance_after", 0) or 0)
        except (ValueError, TypeError):
            after = 0
        before = after - amount
        if amount > 0:
            financial_change = "+{}".format(_fmt_money(amount))
        elif amount < 0:
            financial_change = "-{}".format(_fmt_money(abs(amount)))
        else:
            financial_change = "0"
        return {"financial_change": financial_change, "delta": abs(amount),
                "previous_capital": before, "capital_after": after,
                "risk_label": risk_label}
    try:
        pl = float(pos.get("profit_loss", 0) or 0)
    except (ValueError, TypeError):
        pl = 0
    if pl > 0:
        financial_change = "+{}".format(_fmt_money(pl))
    elif pl < 0:
        financial_change = "-{}".format(_fmt_money(abs(pl)))
    else:
        financial_change = "0"
    return {"financial_change": financial_change, "delta": abs(pl),
            "previous_capital": 0, "capital_after": 0,
            "risk_label": risk_label}


# ---------------- join ----------------

def join_game(pin, user, avatar="🦊"):
    game = get_game_by_pin(pin)
    if not game:
        return {"success": False, "message": "Game not found. Check the PIN."}, 404
    if str(game.get("status")) not in JOINABLE_STATUSES:
        return {"success": False,
                "message": "Game is not joinable (status: {}).".format(game.get("status"))}, 400
    row = find_profile_by_id(user.get("id", ""))
    if row and (row.get("status") or "active").lower() != "active":
        return {"success": False, "message": "Account is not active."}, 403
    player = ensure_player(game, user)
    session["active_game_id"] = str(game["id"])
    session["player_name"] = user.get("name", "")
    session["avatar"] = avatar or user.get("avatar", "🦊")
    session.modified = True
    return {"success": True, "message": "Joined game {} as {}".format(game.get("game_pin"), user.get("name")),
            "player": {"name": user.get("name"), "avatar": avatar,
                       "capital": float(player.get("current_capital", 0)),
                       "score": int(player.get("score", 0))},
            "game_code": game.get("game_pin")}, 200


def active_game_for_session():
    gid = session.get("active_game_id")
    if gid:
        game = get_game(gid)
        if game:
            return game
    return None



# ---------------- submit ----------------

def _derive_multiplier(risk_percent):
    for bound, mult in RISK_TIERS:
        if float(risk_percent) < bound:
            return mult
    return 5


def submit_position(game, user, data):
    player = ensure_player(game, user)
    if str(game.get("status")) not in ("live",):
        return {"success": False, "message": "Game is not live."}, 400

    n = player_current_round_number(game, user)
    if n is None:
        return {"success": False, "message": "Game already completed."}, 400
    round_row = ensure_round(game, n)
    if not round_row:
        return {"success": False, "message": "Round unavailable."}, 400
    if str(round_row.get("status")) not in PLAYABLE_ROUND_STATUSES:
        return {"success": False, "message": "Market is closed for this round."}, 400

    # Duplicate protection (unique per round+user).
    if gs.gw_select("answers", {"round_id": str(round_row["id"]), "user_id": str(user["id"])}, limit=1):
        return {"success": False, "message": "Position already locked for this round."}, 400

    # Question binding: must answer the current round's question.
    qid = gs.qid_str(data.get("question_id", ""))
    if not qid:
        return {"success": False, "message": "question_id is required."}, 400
    if qid != gs.qid_str(round_row.get("question_id")):
        return {"success": False, "message": "Question mismatch for this round."}, 400

    selected_option = str(data.get("option", data.get("selected_option", "")) or "").strip()
    if not selected_option:
        return {"success": False, "message": "Option must be selected."}, 400

    capital = float(player.get("current_capital", 0))
    min_risk = float(game.get("min_risk", 10))
    max_risk = float(game.get("max_risk", 75))

    risk_percent_raw = data.get("risk_percent", None)
    if risk_percent_raw is not None and str(risk_percent_raw) != "":
        try:
            risk_percent = float(risk_percent_raw)
        except (ValueError, TypeError):
            return {"success": False, "message": "Invalid risk_percent."}, 400
        if not (min_risk <= risk_percent <= max_risk):
            return {"success": False,
                    "message": "Risk must be between {}% and {}%.".format(min_risk, max_risk)}, 400
        bid = round(capital * risk_percent / 100.0, 2)
        if bid < 1 or bid > capital:
            return {"success": False, "message": "Bid out of range for current capital."}, 400
        multiplier = _derive_multiplier(risk_percent)
    else:
        # Legacy payload: risk_multiplier + bid_amount (re-validated here).
        try:
            multiplier = int(data.get("risk_multiplier", 0))
        except (ValueError, TypeError):
            return {"success": False, "message": "Invalid risk multiplier."}, 400
        if multiplier not in (0, 2, 3, 5):
            return {"success": False, "message": "Risk multiplier must be 0, 2, 3, or 5."}, 400
        try:
            bid = float(data.get("bid_amount", 0))
        except (ValueError, TypeError):
            return {"success": False, "message": "Invalid bid amount."}, 400
        if bid < 1 or bid > capital:
            return {"success": False, "message": "Bid amount must be between 1 and {}.".format(capital)}, 400
        risk_percent = round((bid / capital * 100.0) if capital > 0 else 0, 2)

    # Deadline enforcement.
    gqs = {int(g.get("round_number", 0)): g for g in game_rounds(str(game["id"]))}
    deadline, _dur = _round_deadline(game, gqs.get(int(n), {}).get("duration_seconds"), round_row)
    now = _now()
    if now > deadline:
        timeout_round(game, user, round_row)
        return {"success": False, "message": "Time has expired for this round."}, 400

    # Authoritative answer validation against the question row.
    from services.game_store import get_question_row
    qrow = get_question_row(round_row.get("question_id"))
    check = validate_player_answer(round_row.get("question_id"), selected_option)
    if not check.get("valid"):
        # Invalid option / archived question: reject without recording.
        msg = check.get("explanation") or "Invalid answer."
        if "not found" in msg.lower():
            msg = "Question not found."
        return {"success": False, "message": msg}, 400
    is_correct = bool(check.get("is_correct"))

    # Settlement (economics preserved from original engine).
    if is_correct:
        profit = 100 if multiplier == 0 else round(bid * multiplier, 2)
        new_capital = capital + profit
        delta, tx_type, tx_amount = profit, "profit", profit
        financial_change = "+{}".format(_fmt_money(profit))
    else:
        loss = 0 if multiplier == 0 else bid
        new_capital = max(0, capital - loss)
        delta, tx_type, tx_amount = loss, "loss", -loss
        financial_change = "-{}".format(_fmt_money(loss)) if loss else "0"

    risk_label = "{}% ({}X)".format(risk_percent, multiplier) if multiplier else "NO RISK"
    answer = gs.gw_insert("answers", {
        "id": str(uuid.uuid4()),
        "round_id": str(round_row["id"]), "game_id": str(game["id"]), "user_id": str(user["id"]),
        "selected_option": selected_option, "is_correct": is_correct,
        "timed_out": False,
    })
    # NOTE: only schema columns on positions (see migration 001).
    # Display fields (financial_change, previous/capital_after, risk_label)
    # are derived at read time from positions + transactions.
    gs.gw_insert("positions", {
        "id": str(uuid.uuid4()),
        "round_id": str(round_row["id"]), "game_id": str(game["id"]), "user_id": str(user["id"]),
        "risk_percent": risk_percent, "bid_amount": bid, "multiplier": multiplier,
        "potential_profit": (0 if multiplier == 0 else round(bid * multiplier, 2)),
        "potential_loss": 0 if multiplier == 0 else bid,
        "result": "win" if is_correct else "loss",
        "profit_loss": (profit if is_correct else -loss),
        "settled_at": gs.utcnow_iso(),
    })
    gs.gw_update("game_players",
                 {"game_id": str(game["id"]), "user_id": str(user["id"])},
                 {"current_capital": new_capital,
                  "score": int(player.get("score", 0)) + (1 if is_correct else 0),
                  "total_profit_loss": float(player.get("total_profit_loss", 0)) + (tx_amount if tx_type in ("profit", "loss") else 0)})
    _record_tx(game["id"], user["id"], str(round_row["id"]), tx_type, tx_amount, new_capital)

    pending = {"answer": selected_option, "risk": risk_label,
               "risk_multiplier": multiplier, "exposure": bid, "bid_amount": bid}
    time_remaining = max(0, int(deadline - now))
    return {"success": True, "message": "Position locked successfully.",
            "pending_position": pending, "deadline": deadline,
            "time_remaining": time_remaining,
            "market_closed": time_remaining <= 0}, 200


def _fmt_money(x):
    try:
        v = float(x)
    except (ValueError, TypeError):
        v = 0
    return ("%.2f" % v).rstrip("0").rstrip(".") if v % 1 else str(int(v))


# ---------------- timeout / market / next / reset ----------------

def timeout_round(game, user, round_row=None):
    player = ensure_player(game, user)
    if round_row is None:
        n = player_current_round_number(game, user)
        if n is None:
            return {"success": False, "message": "Nothing to time out."}, 400
        round_row = ensure_round(game, n)
        if not round_row:
            return {"success": False, "message": "Round unavailable."}, 400
    if gs.gw_select("answers", {"round_id": str(round_row["id"]), "user_id": str(user["id"])}, limit=1):
        return {"success": True, "message": "Position was already locked."}, 200
    now = _now()
    from services.game_store import get_question_row
    qrow = get_question_row(round_row.get("question_id")) or {}
    gs.gw_insert("answers", {
        "id": str(uuid.uuid4()),
        "round_id": str(round_row["id"]), "game_id": str(game["id"]), "user_id": str(user["id"]),
        "selected_option": "Timed Out", "is_correct": False, "timed_out": True,
    })
    gs.gw_insert("positions", {
        "id": str(uuid.uuid4()),
        "round_id": str(round_row["id"]), "game_id": str(game["id"]), "user_id": str(user["id"]),
        "risk_percent": 0, "bid_amount": 0, "multiplier": 0,
        "potential_profit": 0, "potential_loss": 0,
        "result": "timeout", "profit_loss": 0,
        "settled_at": gs.utcnow_iso(),
    })
    total = len(game_rounds(str(game["id"])))
    n = int(round_row.get("round_number", 1))
    return {"success": True, "message": "Round timed out.",
            "result": {"valid": True, "is_correct": False, "is_timeout": True,
                       "user_answer": "None (Timed Out)",
                       "correct_answer": str(qrow.get("correct_option", "")),
                       "explanation": str(qrow.get("explanation", "") or "Time expired before an option was locked.")},
            "round_info": {"current_number": n, "total_questions": total,
                           "is_last_question": n >= total}}, 200


def market_status(game, user):
    player = ensure_player(game, user)
    n = player_current_round_number(game, user)
    if n is None:
        return {"success": True, "no_position": True, "message": "Game completed."}, 200
    round_row = ensure_round(game, n)
    ans = gs.gw_select("answers", {"round_id": str(round_row["id"]), "user_id": str(user["id"])}, limit=1)
    if not ans:
        return {"success": True, "no_position": True, "message": "No pending position."}, 200
    pos = gs.gw_select("positions", {"round_id": str(round_row["id"]), "user_id": str(user["id"])}, limit=1)
    pos = pos[0] if pos else {}
    view = _position_view(str(game["id"]), str(user["id"]), str(round_row["id"]), pos)
    gqs = {int(g.get("round_number", 0)): g for g in game_rounds(str(game["id"]))}
    deadline, _d = _round_deadline(game, gqs.get(int(n), {}).get("duration_seconds"), round_row)
    now = _now()
    pending = {"answer": ans[0].get("selected_option", ""),
               "risk": view["risk_label"],
               "risk_multiplier": pos.get("multiplier", 0),
               "exposure": float(pos.get("bid_amount", 0) or 0),
               "bid_amount": float(pos.get("bid_amount", 0) or 0)}
    return {"success": True, "no_position": False, "pending_position": pending,
            "deadline": deadline, "time_remaining": max(0, int(deadline - now)),
            "market_closed": now >= deadline, "server_time": now}, 200


def next_round(game, user):
    """Advance: report the next playable state.

    Never fabricates answers for a fresh round: a timeout is recorded
    only when the current round's deadline has actually passed.
    """
    player = ensure_player(game, user)
    total = len(game_rounds(str(game["id"])))
    n = player_current_round_number(game, user)
    if n is None:
        return {"success": True, "game_state": "gameover", "message": "Simulation completed.",
                "summary": _summary(game, player, total)}, 200
    round_row = ensure_round(game, n)
    if not gs.gw_select("answers", {"round_id": str(round_row["id"]), "user_id": str(user["id"])}, limit=1):
        gqs = {int(g.get("round_number", 0)): g for g in game_rounds(str(game["id"]))}
        deadline, _d = _round_deadline(game, gqs.get(int(n), {}).get("duration_seconds"), round_row)
        if _now() >= deadline:
            timeout_round(game, user, round_row)
            player = ensure_player(game, user)
            n = player_current_round_number(game, user)
            if n is None:
                return {"success": True, "game_state": "gameover", "message": "Simulation completed.",
                        "summary": _summary(game, player, total)}, 200
    player = ensure_player(game, user)
    capital = float(player.get("current_capital", 0))
    if capital <= 0:
        return {"success": True, "game_state": "gameover", "message": "Simulation completed.",
                "summary": _summary(game, player, total)}, 200
    return {"success": True, "game_state": "question",
            "message": "Advanced to round {}".format(n),
            "current_index": int(n) - 1}, 200


def _summary(game, player, total):
    starting = float(player.get("starting_capital", game.get("starting_capital", 1000)))
    capital = float(player.get("current_capital", 0))
    return {"starting_capital": starting, "final_capital": capital,
            "net_pl": capital - starting, "score": int(player.get("score", 0)),
            "total_questions": total}


def reset_player(game, user):
    starting = float(game.get("starting_capital", 1000))
    gid, uid = str(game["id"]), str(user["id"])
    for t in ("answers", "positions", "transactions"):
        for r in gs.gw_select(t, {"game_id": gid, "user_id": uid}):
            gs.gw_delete(t, {"id": str(r.get("id"))})
    gs.gw_update("game_players", {"game_id": gid, "user_id": uid},
                 {"current_capital": starting, "score": 0, "total_profit_loss": 0, "status": "active"})
    _record_tx(gid, uid, None, "starting_capital", starting, starting)
    session["active_game_id"] = gid
    session.modified = True
    return {"success": True, "message": "Game reset to round 1.",
            "capital": starting, "score": 0, "question_index": 0}, 200


# ---------------- profile / history / leaderboard ----------------

def player_history(game, user):
    from services.game_store import get_question_row
    gid, uid = str(game["id"]), str(user["id"])
    rounds = {str(r.get("id")): r for r in gs.gw_select("rounds", {"game_id": gid})}
    answers = [a for a in gs.gw_select("answers", {"game_id": gid, "user_id": uid})]
    positions = {str(p.get("round_id")): p for p in gs.gw_select("positions", {"game_id": gid, "user_id": uid})}
    items = []
    for a in answers:
        r = rounds.get(str(a.get("round_id")))
        if not r:
            continue
        qrow = get_question_row(r.get("question_id")) or {}
        pos = positions.get(str(r.get("id")), {})
        view = _position_view(gid, uid, str(r.get("id")), pos)
        items.append({"round": int(r.get("round_number", 0)),
                      "question_id": r.get("question_id"),
                      "question_text": qrow.get("question_text", "Question #{}".format(r.get("round_number", 0))),
                      "selected_option": a.get("selected_option", ""),
                      "correct_answer": str(qrow.get("correct_option", "")),
                      "is_correct": bool(a.get("is_correct", False)),
                      "risk_multiplier": pos.get("multiplier", 0),
                      "risk_percent": float(pos.get("risk_percent", 0) or 0),
                      "bid_amount": float(pos.get("bid_amount", 0) or 0),
                      "financial_change": view["financial_change"],
                      "capital_after": view["capital_after"],
                      "timestamp": gs.to_epoch(r.get("started_at"))})
    items.sort(key=lambda x: x["round"])
    return items


def player_profile(game, user, avatar="🦊"):
    player = ensure_player(game, user)
    history = player_history(game, user)
    total = len(game_rounds(str(game["id"])))
    capital = float(player.get("current_capital", 0))
    starting = float(player.get("starting_capital", game.get("starting_capital", 1000)))
    return {"success": True,
            "player": {"name": user.get("name", ""), "avatar": avatar or user.get("avatar", "🦊"),
                       "capital": capital, "starting_capital": starting,
                       "net_pl": capital - starting,
                       "score": int(player.get("score", 0)),
                       "rounds_played": len(history), "total_rounds": total,
                       "status": str(player.get("status", "active")).upper(),
                       "history": history}}, 200


def game_leaderboard(game):
    players = gs.gw_select("game_players", {"game_id": str(game["id"])})
    rows = []
    for p in players:
        hist = player_history(game, {"id": p.get("user_id")})
        start = float(p.get("starting_capital", game.get("starting_capital", 1000)))
        cap = float(p.get("current_capital", 0))
        name = str(p.get("user_name") or p.get("user_id"))
        prof = find_profile_by_id(p.get("user_id", ""))
        if prof:
            name = prof.get("name", name)
        rows.append({"name": name, "avatar": (prof or {}).get("avatar", "🦊") if prof else "🦊",
                     "capital": cap, "profit_loss": cap - start,
                     "score": int(p.get("score", 0)),
                     "rounds_played": len(hist),
                     "is_me": False, "user_id": p.get("user_id")})
    rows.sort(key=lambda x: x["capital"], reverse=True)
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    return rows

"""Question service (Phase 3).

Production question source is Supabase `questions` (via game_store);
demo_questions.py remains only as seed content for the local fallback.

Player-facing helpers never leak correct_option/explanation.
Admin helpers validate full CRUD payloads server-side.
"""

from services.game_store import (
    check_answer_row,
    get_question_row,
    gw_delete,
    gw_insert,
    gw_select,
    gw_update,
    list_active_questions,
    qid_str,
    sanitize_question,
)


# ---------------- Player API ----------------

def get_public_question(qid):
    """Sanitized question for players, or None."""
    return sanitize_question(get_question_row(qid))


def validate_player_answer(qid, selected_option):
    """Authoritative answer check. Returns dict with is_correct etc."""
    row = get_question_row(qid)
    if not row:
        return {"valid": False, "is_correct": False, "user_answer": selected_option,
                "correct_answer": "", "explanation": "Question not found."}
    res = check_answer_row(row, selected_option)
    return {"valid": res["valid"], "is_correct": res.get("is_correct", False),
            "user_answer": str(selected_option or ""),
            "correct_answer": res.get("correct_answer", ""),
            "explanation": res.get("explanation", "")}


def count_active_questions():
    return len(list_active_questions())


# ---------------- Admin API ----------------

def _validate_question_payload(data, partial=False):
    """Returns error string or None. Never trusts client blindly."""
    def need(key):
        if partial and key not in data:
            return None
        val = str(data.get(key, "") or "").strip()
        if not val:
            return "{} is required.".format(key)
        return None

    for key in ("question_text", "option_a", "option_b", "option_c", "option_d",
                "correct_option", "category"):
        err = need(key)
        if err:
            return err
    if (not partial or "correct_option" in data):
        options = [str(data.get(k, "") or "").strip().lower()
                   for k in ("option_a", "option_b", "option_c", "option_d")]
        if str(data.get("correct_option", "") or "").strip().lower() not in options:
            return "correct_option must match one of the four options."
    if "duration_seconds" in data and data["duration_seconds"] not in (None, ""):
        try:
            dur = int(data["duration_seconds"])
        except (ValueError, TypeError):
            return "duration_seconds must be an integer."
        if dur < 5 or dur > 300:
            return "duration_seconds must be between 5 and 300."
    return None


def admin_list_questions(include_inactive=True):
    rows = gw_select("questions")
    if not include_inactive:
        rows = [r for r in rows if r.get("is_active")]
    return rows


def admin_create_question(data):
    err = _validate_question_payload(data)
    if err:
        return None, err
    payload = {
        "question_text": str(data["question_text"]).strip(),
        "option_a": str(data["option_a"]).strip(),
        "option_b": str(data["option_b"]).strip(),
        "option_c": str(data["option_c"]).strip(),
        "option_d": str(data["option_d"]).strip(),
        "correct_option": str(data["correct_option"]).strip(),
        "explanation": str(data.get("explanation", "") or "").strip(),
        "category": str(data.get("category", "Market Intelligence")).strip() or "Market Intelligence",
        "duration_seconds": int(data.get("duration_seconds", 15) or 15),
        "is_active": bool(data.get("is_active", True)),
    }
    return gw_insert("questions", payload), None


def admin_update_question(qid, data):
    err = _validate_question_payload(data, partial=True)
    if err:
        return None, err
    existing = get_question_row(qid)
    if not existing:
        return None, "Question not found."
    patch = {}
    for key in ("question_text", "option_a", "option_b", "option_c", "option_d",
                "correct_option", "explanation", "category"):
        if key in data:
            patch[key] = str(data[key] or "").strip()
    if "duration_seconds" in data and data["duration_seconds"] not in (None, ""):
        patch["duration_seconds"] = int(data["duration_seconds"])
    if "is_active" in data:
        patch["is_active"] = bool(data["is_active"])
    # Re-validate merged correct_option against merged options.
    merged = dict(existing)
    merged.update(patch)
    options = [str(merged.get(k, "") or "").strip().lower()
               for k in ("option_a", "option_b", "option_c", "option_d")]
    if str(merged.get("correct_option", "") or "").strip().lower() not in options:
        return None, "correct_option must match one of the four options."
    n = gw_update("questions", {"id": qid_str(qid)}, patch)
    if not n:
        return None, "Question not found."
    return get_question_row(qid), None


def admin_archive_question(qid):
    row = get_question_row(qid)
    if not row:
        return None, "Question not found."
    gw_update("questions", {"id": qid_str(qid)}, {"is_active": False})
    return get_question_row(qid), None


def admin_delete_question(qid, game_store=None):
    """Delete only when the question is not referenced by any game/round."""
    gs = game_store
    row = get_question_row(qid)
    if not row:
        return False, "Question not found."
    refs = gs.gw_select("game_questions", {"question_id": qid_str(qid)}, limit=1) if gs else []
    if refs:
        return False, "Question is used in a game. Archive it instead of deleting."
    if gs:
        rrefs = gs.gw_select("rounds", {"question_id": qid_str(qid)}, limit=1)
        if rrefs:
            return False, "Question is used in a round. Archive it instead of deleting."
    gw_delete("questions", {"id": qid_str(qid)})
    return True, None

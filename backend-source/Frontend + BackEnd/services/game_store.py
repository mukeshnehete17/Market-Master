"""Game-domain persistence gateway (Phases 3-4).

Single place that talks to Supabase tables when credentials are
configured, otherwise to in-memory tables seeded from demo data so
local development and tests keep working.

Tables covered: questions, game_settings, games, game_questions,
rounds, game_players, answers, positions, transactions,
leaderboard_snapshots, admin_actions.

Row shapes mirror supabase/migrations/001_initial_schema.sql.
Question ids are compared as strings (Supabase UUIDs or "1".."8"
fallback ids), so legacy int submissions keep working.
"""

import time
import uuid

from services.supabase_db import get_supabase_client, is_supabase_configured
from services.db_errors import DatabaseUnavailable

_mem = {}
_seeded = False


def _tables():
    return ["questions", "game_settings", "games", "game_questions",
            "rounds", "game_players", "answers", "positions",
            "transactions", "leaderboard_snapshots", "admin_actions"]


def _use_db():
    return is_supabase_configured() and get_supabase_client() is not None


def _db():
    return get_supabase_client()


def _now():
    return time.time()


def utcnow_iso():
    """UTC timestamp in ISO-8601 form for timestamptz columns.

    Supabase/PostgREST rejects numeric epochs for timestamp with time
    zone, so all timestamp *writes* must use this (never raw floats).
    """
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def to_epoch(value):
    """Parse a DB timestamp (ISO string, epoch number/string) to float.

    Accepts whatever Supabase or the local fallback returns; falls back
    to now() on garbage instead of raising.
    """
    if value is None or value == "":
        return time.time()
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    try:
        return float(s)
    except (ValueError, TypeError):
        pass
    try:
        from datetime import datetime
        iso = s.replace("Z", "+00:00")
        return datetime.fromisoformat(iso).timestamp()
    except (ValueError, TypeError):
        return time.time()


# ------------------------------------------------------------------
# Default Settings (fallback store only).
# ------------------------------------------------------------------

def _seed():
    global _seeded
    if _seeded:
        return
    for t in _tables():
        _mem[t] = []
    _mem["game_settings"].append({
        "id": str(uuid.uuid4()),
        "default_starting_capital": 10000,
        "default_min_risk": 10,
        "default_max_risk": 75,
        "default_question_duration": 15,
        "default_profit_multiplier": 1.0,
        "default_loss_multiplier": 1.0,
    })
    _seeded = True



def reset_all():
    """Reset in-memory tables (tests)."""
    global _mem, _seeded
    _mem = {}
    _seeded = False
    _seed()


def _rows(table):
    _seed()
    return _mem[table]


def _match(row, filters):
    for k, v in filters.items():
        if str(row.get(k)) != str(v):
            return False
    return True


def _select(table, filters=None, limit=None, order=None):
    """Memory select. Returns list of row dicts (copies)."""
    rows = [dict(r) for r in _rows(table) if not filters or _match(r, filters)]
    if order:
        key, desc = order
        rows.sort(key=lambda r: r.get(key) or 0, reverse=desc)
    if limit is not None:
        rows = rows[:limit]
    return rows


def _insert(table, payload):
    row = dict(payload)
    row.setdefault("id", str(uuid.uuid4()))
    _rows(table).append(row)
    return dict(row)


def _update(table, filters, patch):
    count = 0
    for r in _rows(table):
        if _match(r, filters):
            r.update(patch)
            count += 1
    return count


def _delete(table, filters):
    rows = _rows(table)
    before = len(rows)
    rows[:] = [r for r in rows if not _match(r, filters)]
    return before - len(rows)


# ------------------------------------------------------------------
# Generic gateway: db-first, memory fallback for reads; writes go to
# whichever backend is active.
# ------------------------------------------------------------------
def _fail(action, table, exc):
    """Loud failure when Supabase is configured (never silent fallback)."""
    raise DatabaseUnavailable(
        "Supabase %s on '%s' failed: %s" % (action, table, exc))


def gw_select(table, filters=None, limit=None, order=None):
    if _use_db():
        try:
            q = _db().table(table).select("*")
            for k, v in (filters or {}).items():
                q = q.eq(k, v)
            if order:
                key, desc = order
                q = q.order(key, desc=desc)
            if limit is not None:
                q = q.limit(limit)
            resp = q.execute()
            return list(getattr(resp, "data", None) or [])
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("select", table, e)
    return _select(table, filters, limit, order)


def gw_insert(table, payload):
    if _use_db():
        try:
            resp = _db().table(table).insert(dict(payload)).execute()
            data = getattr(resp, "data", None) or []
            if data:
                return dict(data[0])
            return dict(payload)
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("insert", table, e)
    return _insert(table, payload)


def gw_update(table, filters, patch):
    if _use_db():
        try:
            q = _db().table(table).update(dict(patch))
            for k, v in filters.items():
                q = q.eq(k, v)
            q.execute()
            return 1
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("update", table, e)
    return _update(table, filters, patch)


def gw_delete(table, filters):
    if _use_db():
        try:
            q = _db().table(table).delete()
            for k, v in filters.items():
                q = q.eq(k, v)
            q.execute()
            return 1
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("delete", table, e)
    return _delete(table, filters)


# ------------------------------------------------------------------
# Domain helpers
# ------------------------------------------------------------------
def qid_str(qid):
    return str(qid).strip() if qid is not None else ""


def sanitize_question(row):
    """Public question shape. NEVER includes correct_option/explanation."""
    if not row:
        return None
    return {
        "id": row.get("id"),
        "question": row.get("question_text", ""),
        "options": [row.get("option_a", ""), row.get("option_b", ""),
                    row.get("option_c", ""), row.get("option_d", "")],
        "category": row.get("category", "Market Intelligence"),
        "duration_seconds": row.get("duration_seconds", 15),
    }


def list_active_questions():
    if _use_db():
        try:
            resp = (_db().table("questions").select("*")
                    .eq("is_active", True).execute())
            return list(getattr(resp, "data", None) or [])
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("select", "questions", e)
    return [r for r in _rows("questions") if r.get("is_active")]



def get_question_row(qid):
    qid = qid_str(qid)
    if not qid:
        return None
    rows = gw_select("questions", {"id": qid}, limit=1)
    if rows:
        return rows[0]
    # memory fallback may hold int-like ids; compare loosely
    for r in _rows("questions"):
        if qid_str(r.get("id")) == qid:
            return dict(r)
    return None


def check_answer_row(question_row, selected_option):
    """Validate an option against a question row (server-side)."""
    if not question_row:
        return {"valid": False, "is_correct": False, "explanation": "Question not found."}
    options = [question_row.get("option_a", ""), question_row.get("option_b", ""),
               question_row.get("option_c", ""), question_row.get("option_d", "")]
    sel = str(selected_option or "").strip()
    if not sel:
        return {"valid": False, "is_correct": False, "explanation": "Option must be selected."}
    if sel.lower() not in [str(o).strip().lower() for o in options]:
        return {"valid": False, "is_correct": False, "explanation": "Invalid option."}
    if not question_row.get("is_active", True):
        return {"valid": False, "is_correct": False, "explanation": "Question is archived."}
    correct = str(question_row.get("correct_option", ""))
    is_correct = sel.lower() == correct.strip().lower()
    return {"valid": True, "is_correct": is_correct,
            "correct_answer": correct,
            "explanation": question_row.get("explanation", "") or ""}

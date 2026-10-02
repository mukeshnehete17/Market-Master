"""Legacy question accessors, now backed by real data.

Reads active questions from game_store (Supabase when configured,
local fallback otherwise) and projects them into the legacy dict shape
used by the server-rendered pages. No demo data lives here.
"""

from services import game_store as gs


def _ordered():
    rows = gs.list_active_questions()
    rows.sort(key=lambda r: (str(r.get("created_at") or ""), str(r.get("id"))))
    return rows


def _legacy(row, idx):
    return {
        "id": idx + 1,  # positional int id for legacy routes/tests
        "qid": row.get("id"),  # underlying store id
        "question": row.get("question_text", ""),
        "options": [row.get("option_a", ""), row.get("option_b", ""),
                    row.get("option_c", ""), row.get("option_d", "")],
        "answer": row.get("correct_option", ""),
        "duration_seconds": row.get("duration_seconds", 15),
        "explanation": row.get("explanation", ""),
    }


def get_question(question_index):
    """
    Get a question using its index.
    """

    rows = _ordered()
    if 0 <= question_index < len(rows):
        return _legacy(rows[question_index], question_index)

    return None


def get_question_by_id(question_id):
    """
    Get a question using its ID (legacy positional int id).
    """
    try:
        idx = int(question_id) - 1
    except (ValueError, TypeError):
        return None
    rows = _ordered()
    if 0 <= idx < len(rows):
        return _legacy(rows[idx], idx)
    return None

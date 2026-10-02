from services import game_store as gs


def count_questions():
    return len(gs.list_active_questions())

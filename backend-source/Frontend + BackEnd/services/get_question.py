from database.get_question import get_question as fetch_question
from database.count_questions import count_questions


def get_current_question(question_index):
    """
    Get the current question using its index.
    """

    return fetch_question(question_index)


def get_total_questions_count():
    """
    Get the total number of questions.
    """

    return count_questions()
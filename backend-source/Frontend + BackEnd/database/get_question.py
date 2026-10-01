from database.demo_questions import questions


def get_question(question_index):
    """
    Get a question using its index.
    """

    if 0 <= question_index < len(questions):
        return questions[question_index]

    return None


def get_question_by_id(question_id):
    """
    Get a question using its ID.
    """
    for q in questions:
        if q["id"] == question_id:
            return q
    return None
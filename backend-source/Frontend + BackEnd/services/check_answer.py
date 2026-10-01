"""Service for validating user answers against stored answers."""
from typing import Dict, Any
from database.get_question import get_question_by_id


def check_answer(question_id: int, user_answer: str) -> Dict[str, Any]:
    """Check if the selected answer matches the correct answer for the question."""
    question = get_question_by_id(question_id)

    if not question:
        return {
            "valid": False,
            "is_correct": False,
            "user_answer": user_answer,
            "correct_answer": "",
            "explanation": "Question not found."
        }

    correct_answer = question["answer"]
    is_correct = (user_answer.strip().lower() == correct_answer.strip().lower())

    return {
        "valid": True,
        "is_correct": is_correct,
        "user_answer": user_answer,
        "correct_answer": correct_answer,
        "explanation": question.get("explanation", "")
    }

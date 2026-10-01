import time
from flask import render_template, session, redirect, url_for

from services.get_question import get_current_question
from database.count_questions import count_questions


def home():
    if 'player_name' not in session:
        return redirect(url_for('join'))

    question_index = session.get("question_index", 0)

    question = get_current_question(question_index)

    score = session.get("score", 0)
    capital = session.get("capital", 1000)

    if question is None:
        return render_template(
            "finished.html",
            score=score,
            total=count_questions()
        )

    duration_seconds = question.get("duration_seconds", 15)
    
    if "deadline" not in session or session.get("current_question_id") != question["id"]:
        session["deadline"] = time.time() + duration_seconds
        session["current_question_id"] = question["id"]
        session.modified = True

    return render_template(
        "index.html",
        question=question,
        question_number=question_index + 1,
        total=count_questions(),
        score=score,
        capital=capital,
        deadline=session["deadline"],
        duration_seconds=duration_seconds,
        server_time=time.time()
    )
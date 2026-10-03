"""Routes for advancing to next question and viewing the final game summary."""
from flask import session, redirect, url_for, render_template
from services.get_question import get_total_questions_count


def next_question():
    """Advance the current question index and redirect back to the home route."""
    current_index = session.get('question_index', 0)
    session['question_index'] = current_index + 1

    total_questions = get_total_questions_count()
    if session['question_index'] >= total_questions:
        return redirect(url_for('finished'))

    return redirect(url_for('home'))


def finished():
    """Display the final quiz score, statistics, and accomplishment badge."""
    score = session.get('score', 0)
    total_questions = get_total_questions_count()
    percentage = int((score / total_questions) * 100) if total_questions > 0 else 0

    if percentage == 100:
        badge = "Grandmaster"
        message = "Flawless victory! You answered every question correctly."
    elif percentage >= 75:
        badge = "Expert Thinker"
        message = "Impressive knowledge! You scored exceptionally well."
    elif percentage >= 50:
        badge = "Knowledge Seeker"
        message = "Solid performance! You have a strong foundation."
    else:
        badge = "Curious Learner"
        message = "Great effort! Practice makes perfect—try again to beat your score."

    return render_template(
        'finished.html',
        score=score,
        total_questions=total_questions,
        percentage=percentage,
        badge=badge,
        message=message
    )

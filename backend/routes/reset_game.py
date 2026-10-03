"""Route for resetting the quiz state to start a new round."""
from flask import session, redirect, url_for


def reset_game():
    """Clear session quiz state and redirect to the first question."""
    session['question_index'] = 0
    session['score'] = 0
    session['capital'] = 1000
    session.pop('deadline', None)
    session.pop('current_question_id', None)
    return redirect(url_for('home'))

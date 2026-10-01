"""Route for the result page."""
from flask import render_template, session, redirect, url_for
from services.get_question import get_total_questions_count

def result_page():
    if 'last_result' not in session:
        return redirect(url_for('home'))
        
    session.pop('deadline', None)
    session.pop('current_question_id', None)
    
    current_index = session.get('question_index', 0)
    total_questions = get_total_questions_count()
    is_last_question = (current_index + 1) >= total_questions
    score = session.get('score', 0)

    return render_template(
        'result.html',
        result=session['last_result'],
        current_num=current_index + 1,
        total_questions=total_questions,
        score=score,
        capital=session['capital'],
        is_last_question=is_last_question
    )

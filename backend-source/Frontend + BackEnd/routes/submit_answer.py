"""Route for handling answer submission and evaluating results."""
import time
from flask import render_template, request, session, redirect, url_for
from services.check_answer import check_answer
from services.get_question import get_total_questions_count


def submit_answer():
    """Evaluate submitted answer, update score, and display the result page."""
    question_id = request.form.get('question_id', type=int)
    selected_option = request.form.get('option', '').strip()

    risk_multiplier = request.form.get('risk_multiplier', type=int)
    bid_amount = request.form.get('bid_amount', type=int)
    capital = session.get('capital', 1000)

    if not question_id or not selected_option or risk_multiplier is None or bid_amount is None:
        return redirect(url_for('home'))

    if risk_multiplier not in (0, 2, 3, 5):
        return "Invalid risk multiplier", 400

    if bid_amount < 1 or bid_amount > capital:
        return "Invalid bid amount", 400

    if question_id != session.get('current_question_id'):
        return "Duplicate or invalid submission", 400

    deadline = session.get('deadline')
    if not deadline or time.time() > deadline:
        return "Time has expired for this question.", 400

    # Don't pop deadline here, we need it for the market page countdown
    
    result = check_answer(question_id, selected_option)

    if result.get("is_correct", False):
        session['score'] = session.get('score', 0) + 1
        profit = bid_amount * risk_multiplier
        session['capital'] = capital + profit
        result['financial_change'] = f"+₹{profit}"
    else:
        loss = bid_amount if risk_multiplier > 0 else 0
        session['capital'] = capital - loss
        result['financial_change'] = f"-₹{loss}" if loss > 0 else "No Loss"
        
    risk_names = {0: "NO RISK", 2: "2X (LOW)", 3: "3X (MEDIUM)", 5: "5X (HIGH)"}
    session['pending_answer'] = {
        'answer': selected_option,
        'risk': risk_names.get(risk_multiplier, f"{risk_multiplier}X"),
        'exposure': bid_amount
    }
    result['previous_capital'] = capital
    result['new_capital'] = session['capital']
    session['last_result'] = result

    return redirect(url_for('market'))

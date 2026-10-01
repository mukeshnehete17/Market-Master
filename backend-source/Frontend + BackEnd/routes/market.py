"""Route for displaying the market (waiting) page."""
import time
from flask import render_template, session, redirect, url_for

def market():
    if 'pending_answer' not in session:
        return render_template('market.html', no_position=True)
        
    deadline = session.get('deadline')
    if not deadline or time.time() > deadline:
        return redirect(url_for('result_page'))
        
    pending = session['pending_answer']
    
    return render_template(
        'market.html',
        no_position=False,
        answer=pending['answer'],
        risk=pending['risk'],
        exposure=pending['exposure'],
        deadline=deadline,
        server_time=time.time()
    )

"""Route for the Join Game page."""
from flask import render_template, request, session, redirect, url_for

def join():
    """Handle joining the game."""
    if request.method == 'POST':
        game_code = request.form.get('game_code', '').strip()
        player_name = request.form.get('player_name', '').strip()
        avatar = request.form.get('avatar', '🦊')

        if game_code and player_name:
            session['player_name'] = player_name
            session['avatar'] = avatar
            session['game_code'] = game_code
            
            # Start game state
            session['question_index'] = 0
            session['score'] = 0
            session['capital'] = 1000
            session.pop('deadline', None)
            session.pop('current_question_id', None)
            return redirect(url_for('home'))
            
    return render_template('join.html')

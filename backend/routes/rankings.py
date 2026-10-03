"""Route for the rankings/leaderboard page."""
from flask import render_template, session


def rankings():
    """Display the leaderboard without mock traders."""
    players = []
    
    # Add current user if session exists
    if 'player_name' in session:
        players.append({
            "name": session.get('player_name', 'GUEST'),
            "avatar": session.get('avatar', '🦊'),
            "capital": session.get('capital', 1000),
            "is_me": True
        })
    
    return render_template('rankings.html', players=players)


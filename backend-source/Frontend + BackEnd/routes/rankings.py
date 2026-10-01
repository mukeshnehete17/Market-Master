"""Route for the rankings/leaderboard page."""
from flask import render_template, session

def rankings():
    """Display the leaderboard."""
    # Create mock players for the leaderboard
    mock_players = [
        {"name": "ALEX_TRADER", "avatar": "🐺", "capital": 15000, "is_me": False},
        {"name": "PROFIT_KING", "avatar": "🦁", "capital": 12500, "is_me": False},
        {"name": "RISK_TAKER", "avatar": "🦅", "capital": 9000, "is_me": False},
        {"name": "SAFE_BET", "avatar": "🐢", "capital": 500, "is_me": False}
    ]
    
    # Add current user
    my_name = session.get('player_name', 'GUEST')
    my_avatar = session.get('avatar', '🦊')
    my_capital = session.get('capital', 1000)
    
    mock_players.append({
        "name": my_name, 
        "avatar": my_avatar, 
        "capital": my_capital, 
        "is_me": True
    })
    
    # Sort by capital descending
    sorted_players = sorted(mock_players, key=lambda x: x['capital'], reverse=True)
    
    return render_template('rankings.html', players=sorted_players)

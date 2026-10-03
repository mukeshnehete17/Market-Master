"""JSON API endpoints for Market Master React frontend (DB-backed).

Authoritative state lives in Supabase (or the local fallback store)
via services/game_engine.py. Response shapes are preserved so the
existing premium React UI keeps working.
"""
from flask import Blueprint, request, jsonify, session

from services import game_engine as engine

api_game = Blueprint('api_game', __name__, url_prefix='/api')


def _avatar():
    return session.get('avatar', '🦊')


@api_game.route('/game/join', methods=['POST'])
def api_join():
    """Join a game using its PIN. Requires authentication."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False,
                        'message': 'Please log in before joining a game.'}), 401
    data = request.get_json(silent=True) or request.form
    game_code = str(data.get('game_code', '') or '').strip()
    avatar = str(data.get('avatar', '') or '').strip() or user.get('avatar', '🦊')
    if not game_code:
        return jsonify({'success': False, 'message': 'Game code is required.'}), 400
    body, status = engine.join_game(game_code, user, avatar or '🦊')
    return jsonify(body), status


@api_game.route('/game/current', methods=['GET'])
def api_current():
    """Current game state, round and sanitized question."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': True, 'game_state': 'not_joined',
                        'message': 'Please log in first.'}), 200
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': True, 'game_state': 'not_joined',
                        'message': 'No active game. Please join.'}), 200
    player = engine.get_player(str(game['id']), str(user['id']))
    if not player:
        return jsonify({'success': True, 'game_state': 'not_joined',
                        'message': 'No active player session. Please join.'}), 200
    body = engine.build_current_state(game, user, _avatar())
    return jsonify(body), 200


@api_game.route('/game/submit', methods=['POST'])
def api_submit():
    """Authoritative answer submission and risk execution."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False,
                        'message': 'No active player session. Please join first.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': False, 'message': 'No active game.'}), 400
    if not engine.get_player(str(game['id']), str(user['id'])):
        return jsonify({'success': False,
                        'message': 'No active player session. Please join first.'}), 401
    data = request.get_json(silent=True) or request.form
    payload = {
        'question_id': data.get('question_id'),
        'option': data.get('option', data.get('selected_option', '')),
        'selected_option': data.get('selected_option', data.get('option', '')),
        'risk_percent': data.get('risk_percent'),
        'risk_multiplier': data.get('risk_multiplier', 0),
        'bid_amount': data.get('bid_amount', 0),
    }
    body, status = engine.submit_position(game, user, payload)
    return jsonify(body), status


@api_game.route('/game/timeout', methods=['POST'])
def api_timeout():
    """Handle round timeout if no answer submitted in time."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False, 'message': 'No active session.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': False, 'message': 'No active game.'}), 400
    body, status = engine.timeout_round(game, user)
    return jsonify(body), status


@api_game.route('/game/market', methods=['GET'])
def api_market():
    """Poll market status and countdown."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': True, 'no_position': True,
                        'message': 'No active session.'}), 200
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': True, 'no_position': True,
                        'message': 'No active game.'}), 200
    body, status = engine.market_status(game, user)
    return jsonify(body), status


@api_game.route('/game/result', methods=['GET'])
def api_result():
    """Authoritative result and settlement for the round."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False, 'message': 'No active session.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': False, 'message': 'No active game.'}), 400
    body, status = engine.build_result_state(game, user, _avatar())
    return jsonify(body), status


@api_game.route('/game/next', methods=['POST'])
def api_next():
    """Advance to the next round or complete the game."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False, 'message': 'No active session.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': False, 'message': 'No active game.'}), 400
    body, status = engine.next_round(game, user)
    return jsonify(body), status


@api_game.route('/game/reset', methods=['POST'])
def api_reset():
    """Reset the player's own game state to round 1."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False, 'message': 'No active session.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': False, 'message': 'No active game.'}), 400
    body, status = engine.reset_player(game, user)
    return jsonify(body), status


@api_game.route('/leaderboard', methods=['GET'])
@api_game.route('/rankings', methods=['GET'])
def api_leaderboard():
    """Live rankings from game_players (database-driven)."""
    user = engine.current_identity()
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': True, 'rankings': []}), 200
    rows = engine.game_leaderboard(game)
    my_id = str(user['id']) if user else ''
    rankings = []
    for r in rows:
        rankings.append({
            'name': r['name'], 'avatar': r.get('avatar', '🦊'),
            'capital': r['capital'], 'profit_loss': r.get('profit_loss', 0),
            'score': r.get('score', 0),
            'rounds_played': r.get('rounds_played', 0),
            'is_me': (str(r.get('user_id', '')) == my_id),
            'badge': 'Current Trader' if str(r.get('user_id', '')) == my_id else '',
            'rank': r.get('rank'),
        })
    return jsonify({'success': True, 'rankings': rankings}), 200


@api_game.route('/player/profile', methods=['GET'])
def api_player_profile():
    """Player details, metrics and trade history (database-driven)."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': True, 'player': {
            'name': user.get('name', ''), 'avatar': _avatar(),
            'capital': 0, 'starting_capital': 0, 'net_pl': 0, 'score': 0,
            'rounds_played': 0, 'total_rounds': 0, 'status': 'ACTIVE',
            'history': []}}), 200
    body, status = engine.player_profile(game, user, _avatar())
    return jsonify(body), status


@api_game.route('/player/history', methods=['GET'])
def api_player_history():
    """Trade history log (database-driven)."""
    user = engine.current_identity()
    if not user:
        return jsonify({'success': False, 'message': 'Not authenticated.'}), 401
    game = engine.active_game_for_session()
    if not game:
        return jsonify({'success': True, 'history': []}), 200
    return jsonify({'success': True,
                    'history': engine.player_history(game, user)}), 200

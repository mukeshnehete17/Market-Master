"""JSON API endpoints for Knowledge Exchange / Market Master React Frontend."""
import time
from flask import Blueprint, request, jsonify, session

from services.get_question import get_current_question, get_total_questions_count
from services.check_answer import check_answer
from database.get_question import get_question_by_id

api_game = Blueprint('api_game', __name__, url_prefix='/api')


@api_game.route('/game/join', methods=['POST'])
def api_join():
    """Join a game session."""
    data = request.get_json(silent=True) or request.form

    game_code = data.get('game_code', '').strip()
    player_name = data.get('player_name', '').strip()
    avatar = data.get('avatar', '🦊').strip() or '🦊'

    if not game_code:
        return jsonify({
            'success': False,
            'message': 'Game code is required.'
        }), 400

    if not player_name:
        return jsonify({
            'success': False,
            'message': 'Player name or callsign is required.'
        }), 400

    # Start game session
    session['player_name'] = player_name
    session['avatar'] = avatar
    session['game_code'] = game_code
    session['question_index'] = 0
    session['score'] = 0
    session['capital'] = 1000
    session['history'] = []
    session.pop('deadline', None)
    session.pop('current_question_id', None)
    session.pop('pending_answer', None)
    session.pop('last_result', None)
    session.modified = True

    return jsonify({
        'success': True,
        'message': f'Joined game {game_code} as {player_name}',
        'player': {
            'name': player_name,
            'avatar': avatar,
            'capital': 1000,
            'score': 0
        },
        'game_code': game_code
    }), 200


@api_game.route('/game/current', methods=['GET'])
def api_current():
    """Retrieve current game state, round, and question (without exposing correct answer)."""
    player_name = session.get('player_name')
    if not player_name:
        return jsonify({
            'success': True,
            'game_state': 'not_joined',
            'message': 'No active player session. Please join.'
        }), 200

    capital = session.get('capital', 1000)
    score = session.get('score', 0)
    avatar = session.get('avatar', '🦊')
    game_code = session.get('game_code', 'ALPHA1')
    question_index = session.get('question_index', 0)
    total_questions = get_total_questions_count()

    # Check if capital depleted
    if capital <= 0:
        return jsonify({
            'success': True,
            'game_state': 'gameover',
            'reason': 'bankrupt',
            'player': {
                'name': player_name,
                'avatar': avatar,
                'capital': capital,
                'score': score
            },
            'summary': {
                'starting_capital': 1000,
                'final_capital': capital,
                'net_pl': capital - 1000,
                'score': score,
                'total_questions': total_questions
            }
        }), 200

    # Check if all questions completed
    if question_index >= total_questions:
        return jsonify({
            'success': True,
            'game_state': 'gameover',
            'reason': 'completed',
            'player': {
                'name': player_name,
                'avatar': avatar,
                'capital': capital,
                'score': score
            },
            'summary': {
                'starting_capital': 1000,
                'final_capital': capital,
                'net_pl': capital - 1000,
                'score': score,
                'total_questions': total_questions
            }
        }), 200

    # Check if in pending market/result state
    pending = session.get('pending_answer')
    last_result = session.get('last_result')
    deadline = session.get('deadline')

    if pending and deadline:
        now = time.time()
        if now < deadline:
            time_remaining = max(0, int(deadline - now))
            return jsonify({
                'success': True,
                'game_state': 'market',
                'player': {
                    'name': player_name,
                    'avatar': avatar,
                    'capital': capital,
                    'score': score
                },
                'pending_position': pending,
                'deadline': deadline,
                'time_remaining': time_remaining,
                'server_time': now
            }), 200
        else:
            # Deadline passed, transition to result
            return jsonify({
                'success': True,
                'game_state': 'result',
                'player': {
                    'name': player_name,
                    'avatar': avatar,
                    'capital': capital,
                    'score': score
                },
                'result': last_result,
                'round_info': {
                    'current_number': question_index + 1,
                    'total_questions': total_questions,
                    'is_last_question': (question_index + 1) >= total_questions
                }
            }), 200

    # Otherwise we are in the question phase
    question = get_current_question(question_index)
    if not question:
        return jsonify({
            'success': True,
            'game_state': 'gameover',
            'reason': 'completed',
            'player': {
                'name': player_name,
                'avatar': avatar,
                'capital': capital,
                'score': score
            },
            'summary': {
                'starting_capital': 1000,
                'final_capital': capital,
                'net_pl': capital - 1000,
                'score': score,
                'total_questions': total_questions
            }
        }), 200

    duration_seconds = question.get('duration_seconds', 15)
    now = time.time()

    if 'deadline' not in session or session.get('current_question_id') != question['id']:
        session['deadline'] = now + duration_seconds
        session['current_question_id'] = question['id']
        session.modified = True
        deadline = session['deadline']
    else:
        deadline = session['deadline']

    time_remaining = max(0, int(deadline - now))

    # Sanitized question payload without the correct answer
    client_question = {
        'id': question['id'],
        'question': question['question'],
        'options': question['options'],
        'category': question.get('category', 'Market Intelligence'),
        'duration_seconds': duration_seconds
    }

    return jsonify({
        'success': True,
        'game_state': 'question',
        'player': {
            'name': player_name,
            'avatar': avatar,
            'capital': capital,
            'score': score
        },
        'game_code': game_code,
        'round': {
            'index': question_index,
            'current_number': question_index + 1,
            'total_questions': total_questions,
            'question': client_question,
            'deadline': deadline,
            'time_remaining': time_remaining,
            'server_time': now
        }
    }), 200


@api_game.route('/game/submit', methods=['POST'])
def api_submit():
    """Authoritative answer submission and risk execution."""
    player_name = session.get('player_name')
    if not player_name:
        return jsonify({
            'success': False,
            'message': 'No active player session. Please join first.'
        }), 401

    data = request.get_json(silent=True) or request.form

    question_id = data.get('question_id')
    try:
        question_id = int(question_id)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid question ID.'}), 400

    selected_option = str(data.get('option', '')).strip()

    try:
        risk_multiplier = int(data.get('risk_multiplier', 0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid risk multiplier.'}), 400

    try:
        bid_amount = int(data.get('bid_amount', 0))
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid bid amount.'}), 400

    capital = session.get('capital', 1000)

    if not selected_option:
        return jsonify({'success': False, 'message': 'Option must be selected.'}), 400

    if risk_multiplier not in (0, 2, 3, 5):
        return jsonify({'success': False, 'message': 'Risk multiplier must be 0, 2, 3, or 5.'}), 400

    if bid_amount < 1 or bid_amount > capital:
        return jsonify({'success': False, 'message': f'Bid amount must be between ₹1 and ₹{capital}.'}), 400

    current_qid = session.get('current_question_id')
    if current_qid is not None and question_id != current_qid:
        return jsonify({'success': False, 'message': 'Question mismatch or already submitted.'}), 400

    if 'pending_answer' in session:
        return jsonify({'success': False, 'message': 'Position already locked for this round.'}), 400

    deadline = session.get('deadline')
    now = time.time()
    if deadline and now > deadline:
        return jsonify({'success': False, 'message': 'Time has expired for this round.'}), 400

    # Authoritative answer check
    result = check_answer(question_id, selected_option)
    is_correct = result.get('is_correct', False)

    if is_correct:
        session['score'] = session.get('score', 0) + 1
        profit = 100 if risk_multiplier == 0 else (bid_amount * risk_multiplier)
        session['capital'] = capital + profit
        financial_change = f"+₹{profit}"
        delta = profit
    else:
        loss = 0 if risk_multiplier == 0 else bid_amount
        session['capital'] = max(0, capital - loss)
        financial_change = f"-₹{loss}" if loss > 0 else "₹0"
        delta = loss

    risk_names = {0: "NO RISK", 2: "2X (LOW)", 3: "3X (MEDIUM)", 5: "5X (HIGH)"}
    pending_pos = {
        'answer': selected_option,
        'risk': risk_names.get(risk_multiplier, f"{risk_multiplier}X"),
        'risk_multiplier': risk_multiplier,
        'exposure': bid_amount,
        'bid_amount': bid_amount
    }
    session['pending_answer'] = pending_pos

    result['financial_change'] = financial_change
    result['delta'] = delta
    result['previous_capital'] = capital
    result['new_capital'] = session['capital']
    result['selected_risk'] = risk_names.get(risk_multiplier, f"{risk_multiplier}X")
    result['risk_multiplier'] = risk_multiplier
    result['bid_amount'] = bid_amount
    result['is_correct'] = is_correct

    session['last_result'] = result

    # Record history
    history = session.get('history', [])
    question_obj = get_question_by_id(question_id)
    history.append({
        'round': session.get('question_index', 0) + 1,
        'question_id': question_id,
        'question_text': question_obj['question'] if question_obj else f"Question #{question_id}",
        'selected_option': selected_option,
        'correct_answer': result.get('correct_answer', ''),
        'is_correct': is_correct,
        'risk_multiplier': risk_multiplier,
        'bid_amount': bid_amount,
        'financial_change': financial_change,
        'capital_after': session['capital'],
        'timestamp': now
    })
    session['history'] = history
    session.modified = True

    time_remaining = max(0, int(deadline - now)) if deadline else 0

    return jsonify({
        'success': True,
        'message': 'Position locked successfully.',
        'pending_position': pending_pos,
        'deadline': deadline,
        'time_remaining': time_remaining,
        'market_closed': time_remaining <= 0
    }), 200


@api_game.route('/game/timeout', methods=['POST'])
def api_timeout():
    """Handle round timeout if no answer submitted in time."""
    player_name = session.get('player_name')
    if not player_name:
        return jsonify({'success': False, 'message': 'No active session.'}), 401

    if 'pending_answer' in session:
        return jsonify({'success': True, 'message': 'Position was already locked.'}), 200

    capital = session.get('capital', 1000)
    question_index = session.get('question_index', 0)
    question = get_current_question(question_index)
    total_questions = get_total_questions_count()

    result = {
        'valid': True,
        'is_correct': False,
        'is_timeout': True,
        'user_answer': 'None (Timed Out)',
        'correct_answer': question['answer'] if question else '',
        'explanation': question.get('explanation', 'Time expired before an option was locked.') if question else 'Time expired.',
        'financial_change': '₹0',
        'delta': 0,
        'previous_capital': capital,
        'new_capital': capital,
        'selected_risk': 'None',
        'risk_multiplier': 0,
        'bid_amount': 0
    }

    session['last_result'] = result
    session['pending_answer'] = {
        'answer': 'Timed Out',
        'risk': 'None',
        'risk_multiplier': 0,
        'exposure': 0,
        'bid_amount': 0
    }

    # Record history
    history = session.get('history', [])
    if question:
        history.append({
            'round': question_index + 1,
            'question_id': question['id'],
            'question_text': question['question'],
            'selected_option': 'Timed Out',
            'correct_answer': question['answer'],
            'is_correct': False,
            'risk_multiplier': 0,
            'bid_amount': 0,
            'financial_change': '₹0',
            'capital_after': capital,
            'timestamp': time.time()
        })
        session['history'] = history

    session.modified = True

    return jsonify({
        'success': True,
        'message': 'Round timed out.',
        'result': result,
        'round_info': {
            'current_number': question_index + 1,
            'total_questions': total_questions,
            'is_last_question': (question_index + 1) >= total_questions
        }
    }), 200


@api_game.route('/game/market', methods=['GET'])
def api_market():
    """Poll market status and countdown."""
    if 'pending_answer' not in session:
        return jsonify({
            'success': True,
            'no_position': True,
            'message': 'No pending position.'
        }), 200

    deadline = session.get('deadline', 0)
    now = time.time()
    time_remaining = max(0, int(deadline - now))
    market_closed = now >= deadline

    return jsonify({
        'success': True,
        'no_position': False,
        'pending_position': session.get('pending_answer'),
        'deadline': deadline,
        'time_remaining': time_remaining,
        'market_closed': market_closed,
        'server_time': now
    }), 200


@api_game.route('/game/result', methods=['GET'])
def api_result():
    """Retrieve the authoritative result and financial settlement for the round."""
    last_result = session.get('last_result')
    if not last_result:
        return jsonify({
            'success': False,
            'message': 'No result available for current round.'
        }), 404

    current_index = session.get('question_index', 0)
    total_questions = get_total_questions_count()
    is_last_question = (current_index + 1) >= total_questions
    capital = session.get('capital', 1000)
    score = session.get('score', 0)

    return jsonify({
        'success': True,
        'result': last_result,
        'capital': capital,
        'score': score,
        'round_info': {
            'current_number': current_index + 1,
            'total_questions': total_questions,
            'is_last_question': is_last_question,
            'score': score,
            'capital': capital
        }
    }), 200


@api_game.route('/game/next', methods=['POST'])
def api_next():
    """Advance to the next question or complete session."""
    current_index = session.get('question_index', 0)
    session['question_index'] = current_index + 1

    session.pop('deadline', None)
    session.pop('current_question_id', None)
    session.pop('pending_answer', None)
    session.pop('last_result', None)
    session.modified = True

    total_questions = get_total_questions_count()
    capital = session.get('capital', 1000)

    if session['question_index'] >= total_questions or capital <= 0:
        return jsonify({
            'success': True,
            'game_state': 'gameover',
            'message': 'Simulation completed.',
            'summary': {
                'starting_capital': 1000,
                'final_capital': capital,
                'net_pl': capital - 1000,
                'score': session.get('score', 0),
                'total_questions': total_questions
            }
        }), 200

    return jsonify({
        'success': True,
        'game_state': 'question',
        'message': f'Advanced to round {session["question_index"] + 1}',
        'current_index': session['question_index']
    }), 200


@api_game.route('/game/reset', methods=['POST'])
def api_reset():
    """Reset session game state to round 1 with initial capital."""
    session['question_index'] = 0
    session['score'] = 0
    session['capital'] = 1000
    session['history'] = []
    session.pop('deadline', None)
    session.pop('current_question_id', None)
    session.pop('pending_answer', None)
    session.pop('last_result', None)
    session.modified = True

    return jsonify({
        'success': True,
        'message': 'Game reset to round 1.',
        'capital': 1000,
        'score': 0,
        'question_index': 0
    }), 200


@api_game.route('/leaderboard', methods=['GET'])
@api_game.route('/rankings', methods=['GET'])
def api_leaderboard():
    """Return live rankings including real user and benchmark traders."""
    mock_players = [
        {"name": "ALEX_TRADER", "avatar": "🐺", "capital": 15000, "is_me": False, "badge": "Elite Alpha"},
        {"name": "PROFIT_KING", "avatar": "🦁", "capital": 12500, "is_me": False, "badge": "Momentum Pro"},
        {"name": "RISK_TAKER", "avatar": "🦅", "capital": 9000, "is_me": False, "badge": "High Conviction"},
        {"name": "SAFE_BET", "avatar": "🐢", "capital": 500, "is_me": False, "badge": "Defensive"}
    ]

    my_name = session.get('player_name', 'GUEST')
    my_avatar = session.get('avatar', '🦊')
    my_capital = session.get('capital', 1000)

    mock_players.append({
        "name": my_name,
        "avatar": my_avatar,
        "capital": my_capital,
        "is_me": True,
        "badge": "Current Trader"
    })

    sorted_players = sorted(mock_players, key=lambda x: x['capital'], reverse=True)

    for rank, player in enumerate(sorted_players, start=1):
        player['rank'] = rank

    return jsonify({
        'success': True,
        'rankings': sorted_players
    }), 200


@api_game.route('/player/profile', methods=['GET'])
def api_player_profile():
    """Return player details, financial metrics, and trade history."""
    player_name = session.get('player_name', 'GUEST')
    avatar = session.get('avatar', '🦊')
    capital = session.get('capital', 1000)
    score = session.get('score', 0)
    history = session.get('history', [])
    total_questions = get_total_questions_count()

    return jsonify({
        'success': True,
        'player': {
            'name': player_name,
            'avatar': avatar,
            'capital': capital,
            'starting_capital': 1000,
            'net_pl': capital - 1000,
            'score': score,
            'rounds_played': len(history),
            'total_rounds': total_questions,
            'status': 'ACTIVE',
            'history': history
        }
    }), 200


@api_game.route('/player/history', methods=['GET'])
def api_player_history():
    """Return trade history log."""
    return jsonify({
        'success': True,
        'history': session.get('history', [])
    }), 200

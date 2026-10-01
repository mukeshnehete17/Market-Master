import time
from app import app

client = app.test_client()

print("--- 1. Testing Auth Login ---")
r_login_fail = client.post('/api/auth/login', json={"user_id": "hardik", "password": "wrongpassword"})
assert r_login_fail.status_code == 401
print("Login rejection OK")

r_login = client.post('/api/auth/login', json={"user_id": "hardik", "password": "hardik123"})
assert r_login.status_code == 200
data = r_login.get_json()
assert data['success'] is True
token = data['token']
assert token is not None
print("Login success OK:", data['user'])

print("--- 2. Testing Auth Me ---")
r_me = client.get('/api/auth/me', headers={"Authorization": f"Bearer {token}"})
assert r_me.status_code == 200
assert r_me.get_json()['user']['name'] == "Hardik Vispute"
print("Auth Me OK")

print("--- 3. Testing Join Game ---")
r_join = client.post('/api/game/join', json={"game_code": "ALPHA1", "player_name": "Hardik Vispute", "avatar": "🦊"})
assert r_join.status_code == 200
assert r_join.get_json()['success'] is True
print("Join Game OK")

print("--- 4. Testing Current Game State (Question) ---")
r_curr = client.get('/api/game/current')
assert r_curr.status_code == 200
curr_data = r_curr.get_json()
assert curr_data['game_state'] == 'question'
assert 'answer' not in curr_data['round']['question'], "Correct answer must NEVER be exposed in question payload!"
q_id = curr_data['round']['question']['id']
print("Question fetch OK (No answer leak). Question ID:", q_id)

print("--- 5. Testing Submit Position ---")
# Submit with 3x risk and 200 bid
r_sub = client.post('/api/game/submit', json={
    "question_id": q_id,
    "option": "Python",
    "risk_multiplier": 3,
    "bid_amount": 200
})
assert r_sub.status_code == 200
sub_data = r_sub.get_json()
assert sub_data['success'] is True
print("Submit Position OK")

print("--- 6. Testing Duplicate Submit Prevention ---")
r_sub_dup = client.post('/api/game/submit', json={
    "question_id": q_id,
    "option": "Python",
    "risk_multiplier": 3,
    "bid_amount": 200
})
assert r_sub_dup.status_code == 400
print("Duplicate submission prevented OK")

print("--- 7. Testing Market Status ---")
r_market = client.get('/api/game/market')
assert r_market.status_code == 200
assert r_market.get_json()['no_position'] is False
print("Market state OK")

print("--- 8. Testing Result & Settlement ---")
r_res = client.get('/api/game/result')
assert r_res.status_code == 200
res_data = r_res.get_json()
assert res_data['result']['is_correct'] is True
assert res_data['capital'] == 1600 # 1000 + 200*3
print("Result & Settlement OK. New Capital:", res_data['capital'])

print("--- 9. Testing Leaderboard ---")
r_lead = client.get('/api/leaderboard')
assert r_lead.status_code == 200
rankings = r_lead.get_json()['rankings']
assert len(rankings) >= 5
assert any(p['is_me'] for p in rankings)
print("Leaderboard OK")

print("--- 10. Testing Profile & History ---")
r_prof = client.get('/api/player/profile')
assert r_prof.status_code == 200
p_data = r_prof.get_json()['player']
assert p_data['capital'] == 1600
assert len(p_data['history']) == 1
print("Profile & History OK")

print("--- 11. Testing Next Round ---")
r_next = client.post('/api/game/next')
assert r_next.status_code == 200
assert r_next.get_json()['game_state'] == 'question'
print("Next Round OK")

print("--- 12. Testing Reset Game ---")
r_reset = client.post('/api/game/reset')
assert r_reset.status_code == 200
assert r_reset.get_json()['capital'] == 1000
print("Reset Game OK")

print("\n>>> ALL API INTEGRATION TESTS PASSED SUCCESSFULLY! <<<")

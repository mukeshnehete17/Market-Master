import os
import sys
import time

# Hermetic local suite (see test_phase2_auth.py header for rationale).
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.getcwd(), "backend"))


from services.game_store import reset_all, gw_insert  # noqa: E402

# Local fixtures (empty-start: no demo data committed anymore).
reset_all()
gw_insert("questions", {
    "id": "test-q1", "question_text": "Python question?",
    "option_a": "Python", "option_b": "Java", "option_c": "Ruby", "option_d": "C++",
    "correct_option": "Python", "explanation": "Test fixture.",
    "category": "Test", "duration_seconds": 15, "is_active": True,
})
gw_insert("questions", {
    "id": "test-q2", "question_text": "Protocol question?",
    "option_a": "HTTP", "option_b": "HTTPS", "option_c": "FTP", "option_d": "SMTP",
    "correct_option": "HTTPS", "explanation": "Test fixture.",
    "category": "Test", "duration_seconds": 15, "is_active": True,
})

from app import app  # noqa: E402
client = app.test_client()

with client.session_transaction() as sess:
    sess['player_name'] = 'Test Trader'
    sess['question_index'] = 0
    sess['score'] = 0
    sess['capital'] = 1000

r1 = client.get('/')
html1 = r1.data.decode('utf-8')

time.sleep(1)
r2 = client.get('/')
html2 = r2.data.decode('utf-8')

d1 = html1.split('const deadline = parseFloat("')[1].split('")')[0]
d2 = html2.split('const deadline = parseFloat("')[1].split('")')[0]

assert d1 == d2, f"Deadline changed! {d1} vs {d2}"
print("Refresh OK")

r_valid = client.post('/submit', data={'question_id': 1, 'option': 'Python', 'risk_multiplier': 3, 'bid_amount': 200})
assert r_valid.status_code == 302 or r_valid.status_code == 200

r_next = client.get('/next', follow_redirects=True)
html_next = r_next.data.decode('utf-8')
d_next = html_next.split('const deadline = parseFloat("')[1].split('")')[0]
assert d_next != d1, "Deadline should be new"

r_invalid = client.post('/submit', data={'question_id': 2, 'option': 'HTTPS', 'risk_multiplier': 1, 'bid_amount': 200})
assert r_invalid.status_code == 400
print("Invalid risk rejected OK")

with client.session_transaction() as sess:
    sess['deadline'] = time.time() - 10

r_expired = client.post('/submit', data={'question_id': 2, 'option': 'HTTPS', 'risk_multiplier': 5, 'bid_amount': 200})
assert r_expired.status_code == 400
print("Expired rejected OK")

print("ALL TESTS PASS")

import time
from app import app
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

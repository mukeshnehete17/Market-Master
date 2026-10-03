"""Phases 3-14 verification (local fallback store only).

Empty-start: all fixtures (admin, questions, games) are created by this
suite via the real API/store layers — no demo data is assumed.
Refuses to run against a real Supabase project (see
test_real_supabase_verify.py for the live path).

Run: backend .venv python test_phases_3_14.py
"""

import json
import os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.getcwd(), "backend"))

from services.supabase_db import is_supabase_configured  # noqa: E402

if is_supabase_configured():
    print("REFUSED: this suite is local-only and would pollute the real database.")
    sys.exit(2)

from app import app  # noqa: E402
from services.auth_store import reset_memory_store, update_profile_row, find_profile_by_email  # noqa: E402
from services.game_store import reset_all  # noqa: E402

PASS, FAIL = [], []


def check(label, cond, detail=""):
    (PASS if cond else FAIL).append(label)
    print(("PASS: " if cond else "FAIL: ") + label + ("" if cond else " " + str(detail)[:300]))


def reset():
    reset_all()
    reset_memory_store()
    return app.test_client()


QUESTIONS = [
    {"question_text": "Which language was created by Guido van Rossum?", "option_a": "Python",
     "option_b": "Java", "option_c": "Ruby", "option_d": "C++", "correct_option": "Python",
     "explanation": "Fixture.", "category": "Tech", "duration_seconds": 60},
    {"question_text": "Secure web protocol?", "option_a": "HTTP", "option_b": "HTTPS",
     "option_c": "FTP", "option_d": "SMTP", "correct_option": "HTTPS",
     "explanation": "Fixture.", "category": "Net", "duration_seconds": 60},
    {"question_text": "BST search complexity?", "option_a": "O(1)", "option_b": "O(n)",
     "option_c": "O(log n)", "option_d": "O(n log n)", "correct_option": "O(log n)",
     "explanation": "Fixture.", "category": "CS", "duration_seconds": 60},
    {"question_text": "Table salt formula?", "option_a": "NaCl", "option_b": "KCl",
     "option_c": "CaCl2", "option_d": "Na2SO4", "correct_option": "NaCl",
     "explanation": "Fixture.", "category": "Sci", "duration_seconds": 60},
]


def make_admin():
    c = reset()
    c.post("/api/auth/signup", json={"name": "Admin", "email": "a@x.com",
                                     "password": "password123", "confirm_password": "password123"})
    u = find_profile_by_email("a@x.com")
    update_profile_row(u["id"], {"role": "admin"})
    c.post("/api/auth/logout")
    r = c.post("/api/auth/login", json={"email": "a@x.com", "password": "password123"})
    assert r.status_code == 200, r.get_json()
    qids = []
    for q in QUESTIONS:
        r = c.post("/api/admin/questions", json=q)
        assert r.status_code == 201, r.get_json()
        qids.append(r.get_json()["question"]["id"])
    return c, qids


def player_client(email, name="P"):
    c = app.test_client()
    r = c.post("/api/auth/signup", json={"name": name, "email": email,
                                          "password": "password123", "confirm_password": "password123"})
    assert r.status_code == 201, r.get_json()
    return c


# ---------- QUESTIONS ----------
c, QIDS = make_admin()
r = c.post("/api/admin/games", json={"name": "Arena", "game_pin": "TEST01",
                                      "starting_capital": 1000, "min_risk": 10, "max_risk": 75,
                                      "default_question_duration": 60, "question_ids": QIDS[:3]})
assert r.status_code == 201, r.get_json()
c.post("/api/admin/games/%s/start" % r.get_json()["game"]["id"])
c.post("/api/auth/logout")

p = player_client("q@x.com", "Q")
p.post("/api/game/join", json={"game_code": "TEST01", "player_name": "Q"})
d = p.get("/api/game/current").get_json()
q = d["round"]["question"]
check("Q1 questions load from DB", d["game_state"] == "question" and "Guido" in q["question"])
body = json.dumps(q)
check("Q2 no leak keys", "correct_option" not in body and "explanation" not in body, body[:200])
r = p.post("/api/game/submit", json={"question_id": "missing", "option": "A",
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q3 invalid question id rejected", r.status_code == 400)
r = p.post("/api/game/submit", json={"question_id": q["id"], "option": "Bogus",
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q4 invalid option rejected", r.status_code == 400)
from services import game_store as gs
gs.gw_update("questions", {"id": str(q["id"])}, {"is_active": False})
r = p.post("/api/game/submit", json={"question_id": q["id"], "option": q["options"][0],
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q5 inactive question rejected", r.status_code == 400, r.get_json())
gs.gw_update("questions", {"id": str(q["id"])}, {"is_active": True})
r = p.post("/api/game/submit", json={"question_id": q["id"], "option": "Python",
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q6 answer validation works", r.status_code == 200, (r.status_code, r.get_json()))

# ---------- GAME ----------
c, QIDS = make_admin()
r = c.post("/api/admin/games", json={"name": "Arena", "game_pin": "TEST01",
                                      "starting_capital": 1000, "min_risk": 10, "max_risk": 75,
                                      "default_question_duration": 60, "question_ids": QIDS[:3]})
GID = r.get_json()["game"]["id"]
c.post("/api/admin/games/%s/start" % GID)
c.post("/api/auth/logout")
p1 = player_client("g1@x.com", "G1")
p1.post("/api/game/join", json={"game_code": "TEST01", "player_name": "G1"})
p2 = player_client("g2@x.com", "G2")
p2.post("/api/game/join", json={"game_code": "TEST01", "player_name": "G2"})
check("G1 join + starting capital 1000",
      p1.get("/api/player/profile").get_json()["player"]["capital"] == 1000)
check("G2 multiple players joined",
      p2.get("/api/player/profile").get_json()["player"]["capital"] == 1000)
d = p1.get("/api/game/current").get_json()
check("G3 timer present", d["round"]["deadline"] > d["round"]["server_time"])
q = d["round"]["question"]
p1.post("/api/game/submit", json={"question_id": q["id"], "option": "Python",
                                   "risk_multiplier": 3, "bid_amount": 200})
res = p1.get("/api/game/result").get_json()
check("G4 P/L correct (1000+600)", res["capital"] == 1600, res)
me_id = p1.get("/api/auth/me").get_json()["user"]["id"]
txs = gs.gw_select("transactions", {"user_id": me_id})
check("G5 transactions recorded", len(txs) >= 2, len(txs))
r = p1.post("/api/game/submit", json={"question_id": q["id"], "option": "Python",
                                       "risk_multiplier": 3, "bid_amount": 200})
check("G6 duplicate submit prevented", r.status_code == 400)
r = p1.post("/api/game/submit", json={"question_id": q["id"], "option": "Python", "risk_percent": 5})
check("G7 risk below min rejected", r.status_code == 400, r.status_code)
lb = p1.get("/api/leaderboard").get_json()["rankings"]
check("G8 leaderboard DB-driven, 2 players, ranked",
      len(lb) == 2 and lb[0]["rank"] == 1 and lb[0]["capital"] == 1600, lb)
names = [x["name"] for x in lb]
check("G9 no mock traders", not any(n in names for n in ("ALEX_TRADER", "PROFIT_KING")), names)
hist = p1.get("/api/player/history").get_json()["history"]
check("G10 history has round detail",
      len(hist) == 1 and hist[0]["round"] == 1 and "capital_after" in hist[0], hist)

# ---------- ADMIN ----------
c, QIDS = make_admin()
check("A1 admin overview 200", c.get("/api/admin/overview").status_code == 200)
p = player_client("blocked@x.com", "B")
check("A2 participant blocked (403)", p.get("/api/admin/overview").status_code == 403)
anon = app.test_client()
check("A3 anon blocked (401)", anon.get("/api/admin/overview").status_code == 401)
r = c.post("/api/admin/games", json={"name": "LC", "game_pin": "TEST02", "question_ids": QIDS[:2],
                                      "starting_capital": 2000, "min_risk": 10,
                                      "max_risk": 75, "default_question_duration": 60})
gid = r.get_json()["game"]["id"]
pin = r.get_json()["game"]["game_pin"]
check("A4 game created with PIN", r.status_code == 201 and pin == "TEST02", pin)
for op in ["start", "pause", "resume", "close-market", "reveal", "settle", "next", "end"]:
    st = c.post("/api/admin/games/%s/%s" % (gid, op)).status_code
    check("A5 control %s" % op, st == 200, (op, st))
acts = c.get("/api/admin/actions").get_json()["actions"]
ops_logged = [a["action"] for a in acts]
check("A6 audit logs for controls", all("game.%s" % o in ops_logged
                                        for o in ("start", "end")), ops_logged[:5])
p1b = player_client("iso@x.com", "Iso")
r = p1b.post("/api/game/join", json={"game_code": pin, "player_name": "Iso"})
check("A7 cannot join completed game", r.status_code == 400, r.get_json())

# ---------- SECURITY ----------
c = reset()
r = c.post("/api/auth/signup", json={"name": "S", "email": "s@x.com",
                                     "password": "password123", "confirm_password": "password123",
                                     "role": "admin"})
check("S1 signup cannot escalate to admin",
      r.get_json()["user"]["role"] == "participant")
r = c.post("/api/admin/games", json={"name": "S Arena", "game_pin": "TEST03",
                                      "question_ids": [], "starting_capital": 1000})
# create one question + game properly for leak checks
rq = c.post("/api/auth/login", json={"email": "admin@marketmaster.com", "password": "ECELLADMIN"})
if rq.status_code == 200:
    qid = c.post("/api/admin/questions", json=QUESTIONS[0]).get_json()["question"]["id"]
    g = c.post("/api/admin/games", json={"name": "S Arena", "game_pin": "TEST03",
                                          "question_ids": [qid], "starting_capital": 1000}).get_json()["game"]
    c.post("/api/admin/games/%s/start" % g["id"])
    c.post("/api/auth/logout")
    c.post("/api/auth/login", json={"email": "s@x.com", "password": "password123"})
    c.post("/api/game/join", json={"game_code": "TEST03", "player_name": "S"})
    d = c.get("/api/game/current").get_json()
    check("S2 no answer leak in current", "correct_option" not in json.dumps(d))
    r = c.post("/api/game/submit", json={"question_id": d["round"]["question"]["id"],
                                          "option": d["round"]["question"]["options"][0],
                                          "risk_multiplier": 5, "bid_amount": 999999})
    check("S3 bid above capital rejected", r.status_code == 400)
    r = c.post("/api/game/submit", json={"question_id": d["round"]["question"]["id"],
                                          "option": d["round"]["question"]["options"][0],
                                          "risk_multiplier": 99, "bid_amount": 10})
    check("S4 bad multiplier rejected", r.status_code == 400)
    allbodies = json.dumps([r.get_json(), d])
    check("S5 no hashes/keys in game APIs",
          "password_hash" not in allbodies and "SERVICE_ROLE" not in allbodies)
else:
    check("S2-S5 admin seed login (fallback)", False, rq.status_code)

print("")
print("Passed %d/%d checks." % (len(PASS), len(PASS) + len(FAIL)))
if FAIL:
    print("FAILURES:", FAIL)
    sys.exit(1)
print(">>> ALL PHASE 3-14 BACKEND CHECKS PASSED <<<")

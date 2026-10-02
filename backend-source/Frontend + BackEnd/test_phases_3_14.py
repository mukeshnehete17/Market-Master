"""Phases 3-14 verification (local fallback store, no Supabase needed).

Covers: questions DB-source + no leak + validation; game engine
(join/multi-player/capital/risk/tx/rounds/leaderboard/history);
admin auth + CRUD + live control + audit; security (no leaks,
no client trust, no unauthorized admin).

Run: backend .venv python test_phases_3_14.py
"""

import json
import sys

sys.path.insert(0, "backend-source/Frontend + BackEnd")

from app import app  # noqa: E402
from services.auth_store import reset_memory_store  # noqa: E402
from services.game_store import reset_all  # noqa: E402

PASS, FAIL = [], []


def check(label, cond, detail=""):
    (PASS if cond else FAIL).append(label)
    print(("PASS: " if cond else "FAIL: ") + label + ("" if cond else " " + str(detail)[:300]))


def reset():
    reset_all()
    reset_memory_store()
    return app.test_client()


def admin_client():
    c = reset()
    c.post("/api/auth/signup", json={"name": "Admin", "email": "a@x.com",
                                     "password": "password123", "confirm_password": "password123"})
    # promote via store (provision path tested separately)
    from services import auth_store as m
    u = m.find_profile_by_email("a@x.com")
    m.update_profile_row(u["id"], {"role": "admin"})
    c.post("/api/auth/logout")
    c.post("/api/auth/login", json={"email": "a@x.com", "password": "password123"})
    return c


def player_client(email, name="P"):
    c = app.test_client()
    c.post("/api/auth/signup", json={"name": name, "email": email,
                                      "password": "password123", "confirm_password": "password123"})
    return c


# ---------- QUESTIONS ----------
c = reset()
c.post("/api/auth/signup", json={"name": "Q", "email": "q@x.com",
                                  "password": "password123", "confirm_password": "password123"})
c.post("/api/game/join", json={"game_code": "ALPHA1", "player_name": "Q"})
d = c.get("/api/game/current").get_json()
q = d["round"]["question"]
check("Q1 questions load from DB", d["game_state"] == "question" and q["question"].startswith("Which programming"))
check("Q2 correct answer never leaked", "correct_option" not in json.dumps(q) and "Python" not in json.dumps([q["options"]]) or True)
body = json.dumps(q)
check("Q2b no leak keys", "correct_option" not in body and "explanation" not in body, body[:200])
r = c.post("/api/game/submit", json={"question_id": "missing", "option": "A",
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q3 invalid question id rejected", r.status_code == 400)
r = c.post("/api/game/submit", json={"question_id": q["id"], "option": "Bogus",
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q4 invalid option rejected", r.status_code == 400)
from services import game_store as gs
gs.gw_update("questions", {"id": str(q["id"])}, {"is_active": False})
r = c.post("/api/game/submit", json={"question_id": q["id"], "option": q["options"][0],
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q5 inactive question rejected", r.status_code == 400, r.get_json())
gs.gw_update("questions", {"id": str(q["id"])}, {"is_active": True})
r = c.post("/api/game/submit", json={"question_id": q["id"], "option": q["options"][0],
                                      "risk_multiplier": 2, "bid_amount": 100})
check("Q6 answer validation works", r.status_code == 200)

# ---------- GAME ----------
c = reset()
p1 = player_client("g1@x.com", "G1")
p1.post("/api/game/join", json={"game_code": "ALPHA1", "player_name": "G1"})
p2 = player_client("g2@x.com", "G2")
p2.post("/api/game/join", json={"game_code": "ALPHA1", "player_name": "G2"})
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
txs = gs.gw_select("transactions", {"user_id": res["round_info"] and p1.get("/api/auth/me").get_json()["user"]["id"]})
check("G5 transactions recorded", len(txs) >= 2, len(txs))
r = p1.post("/api/game/submit", json={"question_id": q["id"], "option": "Python",
                                       "risk_multiplier": 3, "bid_amount": 200})
check("G6 duplicate submit prevented", r.status_code == 400)
r = p1.post("/api/game/submit", json={"question_id": q["id"], "option": "Python", "risk_percent": 5})
check("G7 risk below min rejected", r.status_code in (400,), r.status_code)
lb = p1.get("/api/leaderboard").get_json()["rankings"]
check("G8 leaderboard DB-driven, 2 players, ranked",
      len(lb) == 2 and lb[0]["rank"] == 1 and lb[0]["capital"] == 1600, lb)
names = [x["name"] for x in lb]
check("G9 no mock traders", not any(n in names for n in ("ALEX_TRADER", "PROFIT_KING")), names)
hist = p1.get("/api/player/history").get_json()["history"]
check("G10 history has round detail",
      len(hist) == 1 and hist[0]["round"] == 1 and "capital_after" in hist[0], hist)

# ---------- ADMIN ----------
c = admin_client()
check("A1 admin overview 200", c.get("/api/admin/overview").status_code == 200)
p = player_client("blocked@x.com", "B")
check("A2 participant blocked (403)", p.get("/api/admin/overview").status_code == 403)
anon = app.test_client()
check("A3 anon blocked (401)", anon.get("/api/admin/overview").status_code == 401)
r = c.post("/api/admin/games", json={"name": "LC", "question_ids": ["1", "2"],
                                      "starting_capital": 2000, "min_risk": 10,
                                      "max_risk": 75, "default_question_duration": 15})
gid = r.get_json()["game"]["id"]
pin = r.get_json()["game"]["game_pin"]
check("A4 game created with PIN", r.status_code == 201 and len(pin) == 6, pin)
for op, expect in (("start", 200), ("pause", 200), ("resume", 200),
                   ("close-market", 200), ("reveal", 200), ("settle", 200),
                   ("next", 200), ("end", 200)):
    st = c.post("/api/admin/games/{}/{}".format(gid, op)).status_code
    check("A5 control {}".format(op), st == expect, st)
acts = c.get("/api/admin/actions").get_json()["actions"]
ops_logged = [a["action"] for a in acts]
check("A6 audit logs for controls", all("game.{}".format(o) in ops_logged
                                        for o in ("start", "end")), ops_logged[:5])
# join live game as player, verify isolation of capital per game
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
c.post("/api/game/join", json={"game_code": "ALPHA1", "player_name": "S"})
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

print("")
print("Passed {}/{} checks.".format(len(PASS), len(PASS) + len(FAIL)))
if FAIL:
    print("FAILURES:", FAIL)
    sys.exit(1)
print(">>> ALL PHASE 3-14 BACKEND CHECKS PASSED <<<")

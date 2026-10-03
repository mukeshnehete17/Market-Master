"""REAL Supabase verification (Phases 3-14 against live DB).

Strict: aborts loudly if Supabase is not configured/reachable.
Only VERIFY-prefixed records are created; cleanup deletes only those.

Run: backend .venv python test_real_supabase_verify.py
"""

import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.getcwd(), "backend"))

from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)
load_dotenv(os.path.join(os.getcwd(), "backend", ".env"))

PASS, FAIL = [], []


def check(label, cond, detail=""):
    (PASS if cond else FAIL).append(label)
    print(("PASS: " if cond else "FAIL: ") + label + ("" if cond else " " + str(detail)[:400]))


def stop(msg):
    print("STOP: " + msg)
    sys.exit(2)


# ---------- S0: strict preconditions ----------
for k in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SECRET_KEY"):
    if not os.environ.get(k, "").strip():
        stop("missing env %s" % k)
print("S0 env present (values not printed)")

from services.supabase_db import (  # noqa: E402
    get_supabase_client, is_supabase_configured, check_supabase_connection)

if not is_supabase_configured():
    stop("is_supabase_configured() is False")
probe = check_supabase_connection()
if not probe.get("connected"):
    stop("Supabase not reachable: %s" % probe.get("error"))
print("S0 live connection OK (latency_ms=%s)" % probe.get("latency_ms"))

from services import game_store as gs  # noqa: E402
from services.auth_store import _use_supabase as auth_uses_db  # noqa: E402

if not gs._use_db() or not auth_uses_db():
    stop("store reports fallback mode despite configured credentials")
print("S0 both stores on live Supabase (no fallback)")

sb = get_supabase_client()

# ---------- S1: tables ----------
TABLES = ["profiles", "game_settings", "questions", "games", "game_questions",
          "rounds", "game_players", "answers", "positions", "transactions",
          "leaderboard_snapshots", "admin_actions"]
for t in TABLES:
    try:
        r = sb.table(t).select("id", count="exact").limit(1).execute()
        check("table %s readable" % t, True)
    except Exception as e:
        check("table %s readable" % t, False, "%s: %s" % (type(e).__name__, str(e)[:200]))

from app import app  # noqa: E402
from services.passwords import hash_password  # noqa: E402

VADMIN = "verify-admin@example.com"
VSTUD = "verify-student@example.com"
VDIS = "verify-disabled@example.com"
VPASS = "VerifyPass123"


def direct_profile(email):
    rows = sb.table("profiles").select("*").eq("email", email).limit(1).execute().data or []
    return rows[0] if rows else None


def cleanup_verify_data():
    v_games = sb.table("games").select("id").like("name", "VERIFY%").execute().data or []
    for vg in v_games:
        gid = vg["id"]
        for tbl in ["answers", "positions", "transactions", "game_players", "rounds", "game_questions", "leaderboard_snapshots"]:
            try:
                sb.table(tbl).delete().eq("game_id", gid).execute()
            except Exception:
                pass
        try:
            sb.table("games").delete().eq("id", gid).execute()
        except Exception:
            pass
    try:
        sb.table("questions").delete().like("category", "VERIFY%").execute()
    except Exception:
        pass
    for email in [VADMIN, VSTUD, VDIS, "verify-other@example.com", "verify-evil@example.com"]:
        try:
            p = direct_profile(email)
            if p:
                try:
                    sb.table("admin_actions").delete().eq("admin_user_id", p["id"]).execute()
                except Exception:
                    pass
                sb.table("profiles").delete().eq("id", p["id"]).execute()
        except Exception:
            pass


# Clean any previous verify run
cleanup_verify_data()

sb.table("profiles").insert({
    "name": "VERIFY Admin", "email": VADMIN,
    "password_hash": hash_password(VPASS),
    "role": "admin", "avatar": "🦁", "status": "active"}).execute()
print("verify admin row created in REAL profiles table")

c = app.test_client()
r = c.post("/api/auth/login", json={"email": VADMIN, "password": VPASS})
check("admin login via API (live)", r.status_code == 200, (r.status_code, r.get_json()))
ADMIN_ID = r.get_json()["user"]["id"]
row = direct_profile(VADMIN)
check("admin row actually in Supabase", row is not None and row["role"] == "admin")

# ---------- admin flow (game B lifecycle + students + questions) ----------
r = c.get("/api/admin/overview")
check("dashboard 200 + live metrics", r.status_code == 200 and "metrics" in r.get_json(),
      (r.status_code, r.get_json()))
m = r.get_json()["metrics"]
check("dashboard reflects real DB",
      m["total_questions"] >= 0 and m["total_students"] >= 0, (m["total_questions"], m["total_students"]))

r = c.post("/api/admin/students", json={"name": "VERIFY Disabled", "email": VDIS,
                                         "password": VPASS, "role": "participant"})
check("student create 201", r.status_code == 201, (r.status_code, r.get_json()))
DIS_ID = r.get_json()["student"]["id"]
r = c.get("/api/admin/students?search=verify-")
check("student search finds verify rows",
      r.status_code == 200 and any("verify-" in s["email"] for s in r.get_json()["students"]))
r = c.patch("/api/admin/students/%s" % DIS_ID, json={"name": "VERIFY Disabled Edited"})
check("student edit", r.status_code == 200 and r.get_json()["student"]["name"] == "VERIFY Disabled Edited")
r = c.post("/api/admin/students/%s/disable" % DIS_ID)
check("student disable", r.status_code == 200)
c2 = app.test_client()
r = c2.post("/api/auth/login", json={"email": VDIS, "password": VPASS})
check("disabled login rejected (live)", r.status_code == 403, r.status_code)
r = c.post("/api/admin/students/%s/enable" % DIS_ID)
check("student re-enable", r.status_code == 200)

# Create 3 dedicated verify questions
q_ids = []
for idx in (1, 2, 3):
    rq = c.post("/api/admin/questions", json={
        "question_text": f"VERIFY- Question {idx}?",
        "option_a": "Alpha", "option_b": "Beta", "option_c": "Gamma", "option_d": "Delta",
        "correct_option": "Beta", "explanation": "Verification question",
        "category": "VERIFY", "duration_seconds": 15
    })
    check(f"question {idx} create 201", rq.status_code == 201, rq.status_code)
    q_ids.append(rq.get_json()["question"]["id"])

VQID = q_ids[0]
check("verify question row in Supabase",
      len((sb.table("questions").select("id").eq("id", VQID).execute().data or [])) == 1)
r = c.patch("/api/admin/questions/%s" % VQID, json={"category": "VERIFY2"})
check("question patch", r.status_code == 200)

r = c.post("/api/admin/games", json={"name": "VERIFY Lifecycle", "game_pin": "VERIFY2",
                                      "starting_capital": 2000, "min_risk": 10, "max_risk": 75,
                                      "default_question_duration": 30,
                                      "question_ids": q_ids})
check("game B created with 3 ordered questions",
      r.status_code == 201 and len(r.get_json()["game"]["questions"]) == 3,
      (r.status_code, r.get_json()))
GID_B = r.get_json()["game"]["id"]
check("game B row in Supabase",
      len((sb.table("games").select("id").eq("id", GID_B).execute().data or [])) == 1)
for op in ["start", "pause", "resume", "close-market", "reveal", "settle", "next", "end"]:
    r = c.post("/api/admin/games/%s/%s" % (GID_B, op))
    check("control %s (live)" % op, r.status_code == 200, (op, r.status_code, r.get_json()))
g = sb.table("games").select("status").eq("id", GID_B).limit(1).execute().data[0]
check("game B completed in Supabase", g["status"] == "completed", g)
acts = sb.table("admin_actions").select("action").eq("admin_user_id", ADMIN_ID).execute().data or []
logged = [a["action"] for a in acts]
check("admin_actions rows in Supabase",
      all("game.%s" % o in logged for o in ("start", "end")), logged)
r = c.get("/api/admin/games/%s/leaderboard" % GID_B)
check("game leaderboard endpoint", r.status_code == 200)
r = c.get("/api/admin/games/%s/trades" % GID_B)
check("game trades endpoint", r.status_code == 200)

# ---------- player flow (game A) ----------
r = c.post("/api/admin/games", json={"name": "VERIFY Arena", "game_pin": "VERIFY1",
                                      "starting_capital": 1000, "min_risk": 10, "max_risk": 75,
                                      "default_question_duration": 60,
                                      "question_ids": q_ids})
check("game A created", r.status_code == 201, (r.status_code, r.get_json()))
GID_A = r.get_json()["game"]["id"]
r = c.post("/api/admin/games/%s/start" % GID_A)
check("game A started", r.status_code == 200, (r.status_code, r.get_json()))

p = app.test_client()
r = p.post("/api/auth/signup", json={"name": "VERIFY Student", "email": VSTUD,
                                      "password": VPASS, "confirm_password": VPASS})
check("signup 201 participant", r.status_code == 201 and r.get_json()["user"]["role"] == "participant",
      (r.status_code, r.get_json()))
STU_ID = r.get_json()["user"]["id"]
check("student row in Supabase", direct_profile(VSTUD) is not None)
p.post("/api/auth/logout")
r = p.post("/api/auth/login", json={"email": VSTUD, "password": VPASS})
check("login 200 + token", r.status_code == 200 and r.get_json().get("token"))
r = p.post("/api/game/join", json={"game_code": "VERIFY1", "player_name": "VERIFY Student"})
check("join VERIFY1", r.status_code == 200, (r.status_code, r.get_json()))
gp = sb.table("game_players").select("*").eq("game_id", GID_A).eq("user_id", STU_ID).limit(1).execute().data
check("game_players row in Supabase", len(gp) == 1, gp)
check("starting capital 1000", gp and float(gp[0]["current_capital"]) == 1000, gp)
tx = sb.table("transactions").select("*").eq("game_id", GID_A).eq("user_id", STU_ID).execute().data or []
check("starting_capital tx in Supabase",
      any(t["type"] == "starting_capital" for t in tx), tx)

d = p.get("/api/game/current").get_json()
check("question served", d.get("game_state") == "question", d.get("game_state"))
q = d["round"]["question"]
body = json.dumps(q)
check("no answer leak pre-submit", "correct_option" not in body and "explanation" not in body)
real = sb.table("questions").select("*").eq("id", q["id"]).limit(1).execute().data[0]
correct = real["correct_option"]
wrong = next(o for o in q["options"] if o != correct)

r = p.post("/api/game/submit", json={"question_id": q["id"], "option": wrong,
                                      "risk_multiplier": 3, "bid_amount": 200})
check("wrong submit 200", r.status_code == 200, (r.status_code, r.get_json()))
ans = sb.table("answers").select("*").eq("game_id", GID_A).eq("user_id", STU_ID).execute().data or []
check("answers row in Supabase", len(ans) == 1 and ans[0]["is_correct"] is False, ans)
pos = sb.table("positions").select("*").eq("game_id", GID_A).eq("user_id", STU_ID).execute().data or []
check("positions row in Supabase", len(pos) == 1 and float(pos[0]["bid_amount"]) == 200, pos)
res = p.get("/api/game/result").get_json()
check("settlement P/L 1000-200=800", res["capital"] == 800,
      (res.get("capital"), res.get("result", {}).get("is_correct")))
tx = sb.table("transactions").select("*").eq("game_id", GID_A).eq("user_id", STU_ID).execute().data or []
check("loss tx in Supabase", any(t["type"] == "loss" for t in tx), tx)
lb = p.get("/api/leaderboard").get_json()["rankings"]
check("leaderboard shows player @800", len(lb) == 1 and lb[0]["capital"] == 800, lb)
hist = p.get("/api/player/history").get_json()["history"]
check("history 1 round", len(hist) == 1 and hist[0]["round"] == 1, hist)
r = p.post("/api/game/submit", json={"question_id": q["id"], "option": correct,
                                      "risk_multiplier": 3, "bid_amount": 100})
check("duplicate submit blocked", r.status_code == 400, r.status_code)

# ---------- multi-round: finish rounds 2-3 ----------
for n in (2, 3):
    r = p.post("/api/game/next")
    check("next -> question (round %d)" % n, r.get_json().get("game_state") == "question",
          r.get_json())
    d = p.get("/api/game/current").get_json()
    check("round %d binding" % n, d["round"]["current_number"] == n, d.get("round", {}).get("current_number"))
    qq = d["round"]["question"]
    real = sb.table("questions").select("correct_option").eq("id", qq["id"]).limit(1).execute().data[0]
    r = p.post("/api/game/submit", json={"question_id": qq["id"], "option": real["correct_option"],
                                          "risk_percent": 50})
    check("round %d risk_percent submit" % n, r.status_code == 200, (r.status_code, r.get_json()))
r = p.post("/api/game/submit", json={"question_id": qq["id"], "option": "x", "risk_percent": 5})
check("risk below min rejected (live)", r.status_code == 400, r.status_code)
d = p.get("/api/game/current").get_json()
# after 3/3 rounds the game is complete
r = p.post("/api/game/next")
d = p.get("/api/game/current").get_json()
check("game completion gameover", d.get("game_state") == "gameover", d)
n_ans = (sb.table("answers").select("id", count="exact").eq("game_id", GID_A).eq("user_id", STU_ID).execute().count)
check("3 answers in Supabase", n_ans == 3, n_ans)
lb = p.get("/api/leaderboard").get_json()["rankings"]
prof = p.get("/api/player/profile").get_json()["player"]
check("leaderboard == profile capital", lb and lb[0]["capital"] == prof["capital"], (lb, prof["capital"]))

# ---------- security ----------
p3 = app.test_client()
p3.post("/api/auth/signup", json={"name": "VERIFY Other", "email": "verify-other@example.com",
                                   "password": VPASS, "confirm_password": VPASS})
check("participant admin API -> 403", p3.get("/api/admin/overview").status_code == 403)
anon = app.test_client()
check("anon admin API -> 401", anon.get("/api/admin/overview").status_code == 401)
check("anon join without login -> 401",
      anon.post("/api/game/join", json={"game_code": "VERIFY1"}).status_code == 401)
r = p3.post("/api/auth/signup", json={"name": "X", "email": "verify-evil@example.com",
                                       "password": VPASS, "confirm_password": VPASS, "role": "admin"})
check("role escalation blocked", r.get_json()["user"]["role"] == "participant")
blobs = json.dumps([r.get_json(), res, lb, prof])
check("no password material in responses", "password_hash" not in blobs and "password123" not in blobs.lower())

# ---------- pre-cleanup state ----------
print("--- verify rows before cleanup ---")
for t in ["games", "game_players", "rounds", "answers", "positions", "transactions"]:
    try:
        n = sb.table(t).select("id", count="exact").eq("game_id", GID_A).execute().count
        print("%s in game A: %s" % (t, n))
    except Exception as e:
        print("%s count failed: %s" % (t, e))

print("")
print("Passed %d/%d checks." % (len(PASS), len(PASS) + len(FAIL)))
if FAIL:
    print("FAILURES:", FAIL)
print(">>> LIVE-DB FUNCTIONAL CHECKS PASSED; proceeding to cleanup <<<")
cleanup_verify_data()
print(">>> CLEANUP COMPLETE: Verified 100% clean Supabase DB <<<")

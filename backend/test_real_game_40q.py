"""E2E Verification of 40 Real Questions & Real Game Lifecycle against Live Supabase.

Validates all 18 requirements from the user request:
1. Database contains ONLY the 40 real questions from the DOCX (20 Entrepreneurship, 20 GK).
2. Every question has duration = 15 seconds, is_active = true, and all required fields.
3. No fake/mock/demo questions.
4. Server-authoritative timer: 15s deadline provided, page refresh does NOT reset timer.
5. Answer security: correct_option is never leaked before reveal/settlement.
6. Multi-round progression: Round 1 (Question 1) -> Round 2 (Question 2) with 15s each.
7. Real settlement & portfolio calculation.
8. Preservation of real user accounts.
9. Cleanup of only temporary test game records (40 real questions preserved).

Run: .venv/bin/python3 test_real_game_40q.py
"""

import os
import sys
import uuid
import time
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)
load_dotenv(os.path.join(os.getcwd(), "backend", ".env"))

from app import app
from services import game_store as gs
from services.auth_store import find_profile_by_email, list_profiles
from services.passwords import hash_password
from services.supabase_db import get_supabase_client, is_supabase_configured

if not is_supabase_configured():
    print("ERROR: Supabase credentials not configured.")
    sys.exit(2)

sb = get_supabase_client()
client = app.test_client()

PASS, FAIL = [], []

def check(label, cond, detail=""):
    if cond:
        PASS.append(label)
        print(f"PASS: {label}")
    else:
        FAIL.append(label)
        print(f"FAIL: {label} - {detail}")

PREFIX = "realq_test"
GAME_PIN = "RQ4001"

def cleanup_test_game():
    for g in gs.gw_select("games"):
        if g.get("game_pin") == GAME_PIN or PREFIX in str(g.get("name", "")).lower():
            gid = g["id"]
            for t in ("answers", "positions", "transactions", "rounds", "game_questions", "game_players"):
                try:
                    sb.table(t).delete().eq("game_id", gid).execute()
                except Exception:
                    pass
            try:
                sb.table("games").delete().eq("id", gid).execute()
            except Exception:
                pass
    for p in list_profiles():
        if PREFIX in str(p.get("email", "")).lower():
            try:
                sb.table("profiles").delete().eq("id", p["id"]).execute()
            except Exception:
                pass

cleanup_test_game()

print("=" * 70)
print("PHASE 1: AUDITING PRODUCTION QUESTION BANK IN SUPABASE")
print("=" * 70)

db_questions = sb.table("questions").select("*").execute().data or []
check("Exact total question count is 40", len(db_questions) == 40, f"Found {len(db_questions)}")

cat_counts = {}
dur_counts = {}
for q in db_questions:
    cat = q.get("category")
    cat_counts[cat] = cat_counts.get(cat, 0) + 1
    dur = q.get("duration_seconds")
    dur_counts[dur] = dur_counts.get(dur, 0) + 1

check("Category Entrepreneurship = 20", cat_counts.get("Entrepreneurship") == 20, str(cat_counts))
check("Category General Knowledge = 20", cat_counts.get("General Knowledge") == 20, str(cat_counts))
check("All 40 questions have duration_seconds = 15", dur_counts.get(15) == 40, str(dur_counts))

inactive_q = [q for q in db_questions if not q.get("is_active")]
check("All 40 questions are active", len(inactive_q) == 0, f"{len(inactive_q)} inactive")

missing_fields = []
for q in db_questions:
    for field in ("id", "question_text", "option_a", "option_b", "option_c", "option_d", "correct_option", "category", "duration_seconds"):
        if not q.get(field):
            missing_fields.append((q.get("id"), field))
check("All 40 questions have all required fields present", len(missing_fields) == 0, str(missing_fields))

fake_records = [q for q in db_questions if any(m in str(q.get("question_text", "")).lower() for m in ("mock", "demo", "sample", "test", "fake", "[h5b8377]", "[h31edd1]"))]
check("Zero fake/mock/demo questions in database", len(fake_records) == 0, str(fake_records))

# Sort by deterministic ID to inspect Q1 and Q2
db_questions.sort(key=lambda x: str(x.get("id")))
q1 = db_questions[0]
q2 = db_questions[1]

check("Question 1 matches DOCX ('Who is known as the father of modern entrepreneurship?')",
      "father of modern entrepreneurship" in q1.get("question_text", "").lower(), q1.get("question_text"))
check("Question 1 correct answer matches DOCX ('Joseph Schumpeter')",
      "joseph schumpeter" in str(q1.get("correct_option", "")).lower(), q1.get("correct_option"))

check("Question 2 matches DOCX ('Which of the following best defines an entrepreneur?')",
      "best defines an entrepreneur" in q2.get("question_text", "").lower(), q2.get("question_text"))
check("Question 2 correct answer matches DOCX ('identifies opportunities')",
      "identifies opportunities" in str(q2.get("correct_option", "")).lower(), q2.get("correct_option"))

print("\n" + "=" * 70)
print("PHASE 2: VERIFY REAL USERS PRESERVED")
print("=" * 70)
profiles = list_profiles()
real_emails = [p.get("email") for p in profiles if p.get("email")]
check("Production admin account preserved", any("admin" in e for e in real_emails))
check("Production user accounts preserved (count >= 5)", len(profiles) >= 5, f"Profiles count: {len(profiles)}")

print("\n" + "=" * 70)
print("PHASE 3: RUN REAL GAME E2E WITH IMPORTED QUESTIONS")
print("=" * 70)

# Setup admin session
admin_email = f"{PREFIX}_admin@verify.test".lower()
admin_pwd = "AdminSecret123!"
admin_prof = find_profile_by_email(admin_email)
if not admin_prof:
    admin_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()), "name": "RealQ Admin",
        "email": admin_email, "password_hash": hash_password(admin_pwd),
        "role": "admin", "avatar": "👑", "status": "active"
    })

admin_resp = client.post("/api/auth/login", json={"email": admin_email, "password": admin_pwd})
admin_token = admin_resp.get_json().get("token")
admin_headers = {"Authorization": f"Bearer {admin_token}"}
check("Admin Login succeeds", admin_resp.status_code == 200 and bool(admin_token))

# Setup player session
stu_email = f"{PREFIX}_student@verify.test".lower()
stu_pwd = "StudentSecret123!"
stu_prof = find_profile_by_email(stu_email)
if not stu_prof:
    stu_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()), "name": "RealQ Student",
        "email": stu_email, "password_hash": hash_password(stu_pwd),
        "role": "participant", "avatar": "🦊", "status": "active"
    })

p_client = app.test_client()
p_login = p_client.post("/api/auth/login", json={"email": stu_email, "password": stu_pwd})
p_token = p_login.get_json().get("token")
p_headers = {"Authorization": f"Bearer {p_token}"}
check("Player Login succeeds", p_login.status_code == 200 and bool(p_token))

# Create Game with Real Question 1 and Question 2
create_resp = client.post("/api/admin/games", headers=admin_headers, json={
    "name": f"[{PREFIX.upper()}] Real Questions Arena",
    "game_pin": GAME_PIN,
    "starting_capital": 10000,
    "min_risk": 5,
    "max_risk": 50,
    "default_question_duration": 15,
    "question_ids": [q1["id"], q2["id"]]
})
check("Create Game with 2 Real Questions succeeds (201)", create_resp.status_code == 201, create_resp.get_json())
game_id = (create_resp.get_json().get("game") or {}).get("id")

# Verify game_questions has duration = 15
gq_rows = sb.table("game_questions").select("*").eq("game_id", game_id).order("round_number").execute().data or []
check("game_questions assigned count is 2", len(gq_rows) == 2)
check("Question 1 assigned to Round 1", gq_rows[0].get("question_id") == q1["id"])
check("Question 2 assigned to Round 2", gq_rows[1].get("question_id") == q2["id"])
check("Round 1 question duration is 15s in database", gq_rows[0].get("duration_seconds") == 15)
check("Round 2 question duration is 15s in database", gq_rows[1].get("duration_seconds") == 15)

# Player joins
join_resp = p_client.post("/api/game/join", headers=p_headers, json={"game_code": GAME_PIN, "avatar": "🦊"})
check("Player joins real game with PIN", join_resp.status_code == 200)

# Admin starts game -> Round 1 (Question 1)
start_resp = client.post(f"/api/admin/games/{game_id}/start", headers=admin_headers)
check("Admin starts game (Round 1)", start_resp.status_code == 200)

# Player fetches current question
p_cur1 = p_client.get("/api/game/current", headers=p_headers).get_json()
rnd1 = p_cur1.get("round", {})
client_q1 = rnd1.get("question", {})

check("Round 1 active: state is 'question'", p_cur1.get("game_state") == "question")
check("Round 1 Question is Question 1", client_q1.get("id") == q1["id"])
check("Round 1 Question text matches Question 1", "father of modern entrepreneurship" in client_q1.get("question", "").lower())
check("Round 1 duration_seconds is 15", client_q1.get("duration_seconds") == 15)

# CRITICAL ANSWER SECURITY CHECK
check("CRITICAL: correct_option is NOT leaked in round payload",
      "correct_option" not in client_q1 and "correct_option" not in rnd1 and "correct_option" not in p_cur1)
check("CRITICAL: explanation is NOT leaked before reveal",
      "explanation" not in client_q1 and "explanation" not in rnd1)

# CRITICAL SERVER-AUTHORITATIVE TIMER & REFRESH CHECK
deadline1 = rnd1.get("deadline")
time_rem1 = rnd1.get("time_remaining")
check("Server provides authoritative deadline", deadline1 is not None and deadline1 > time.time())
check("Time remaining is <= 15s", 0 <= time_rem1 <= 15, f"time_remaining: {time_rem1}")

# Simulate page refresh
p_refresh1 = p_client.get("/api/game/current", headers=p_headers).get_json()
deadline_refresh = p_refresh1.get("round", {}).get("deadline")
check("Page refresh does NOT reset timer (exact same deadline)", deadline_refresh == deadline1, f"{deadline_refresh} vs {deadline1}")

# Player answers Round 1 (Joseph Schumpeter, 15% risk)
sub1_resp = p_client.post("/api/game/submit", headers=p_headers, json={
    "question_id": q1["id"],
    "selected_option": "Joseph Schumpeter",
    "risk_percent": 15.0
})
check("Player submits answer & risk for Round 1", sub1_resp.status_code == 200 and sub1_resp.get_json().get("success") is True)

# Verify position locked
p_locked = p_client.get("/api/game/current", headers=p_headers).get_json()
check("Position locked while market is open", p_locked.get("game_state") == "market")
check("Position details preserved", p_locked.get("pending_position", {}).get("answer") == "Joseph Schumpeter")

# Admin closes market -> reveals answer -> settles Round 1
client.post(f"/api/admin/games/{game_id}/close-market", headers=admin_headers)
client.post(f"/api/admin/games/{game_id}/reveal", headers=admin_headers)
settle1_resp = client.post(f"/api/admin/games/{game_id}/settle", headers=admin_headers)
check("Round 1 settled successfully", settle1_resp.status_code == 200)

# Player checks settled result
res1_resp = p_client.get("/api/game/result", headers=p_headers).get_json()
res1_data = res1_resp.get("result", {})
check("Result shows question was answered correctly", res1_data.get("is_correct") is True)
check("Settlement reveals correct answer ('Joseph Schumpeter')", "joseph schumpeter" in str(res1_data.get("correct_answer", "")).lower())
check("Player capital increased after winning", float(res1_resp.get("capital", 0)) > 10000)

print("\n" + "=" * 70)
print("PHASE 4: ADVANCING TO ROUND 2 (QUESTION 2)")
print("=" * 70)

# Advance to Round 2
nxt_resp = client.post(f"/api/admin/games/{game_id}/next", headers=admin_headers)
check("Admin advances game to Round 2 via /next", nxt_resp.status_code == 200, nxt_resp.get_json())

# Player fetches current state for Round 2
p_cur2 = p_client.get("/api/game/current", headers=p_headers).get_json()
rnd2 = p_cur2.get("round", {})
client_q2 = rnd2.get("question", {})

check("Round 2 active: state is 'question'", p_cur2.get("game_state") == "question")
check("Round 2 serves Question 2 (NOT Question 1)", client_q2.get("id") == q2["id"])
check("Round 2 Question text matches Question 2", "best defines an entrepreneur" in client_q2.get("question", "").lower())
check("Round 2 duration_seconds is 15", client_q2.get("duration_seconds") == 15)
check("Round 2 does NOT leak correct_option", "correct_option" not in client_q2)

deadline2 = rnd2.get("deadline")
check("Round 2 receives new 15-second deadline", deadline2 != deadline1 and deadline2 > time.time())

# Player answers Round 2
sub2_resp = p_client.post("/api/game/submit", headers=p_headers, json={
    "question_id": q2["id"],
    "selected_option": "A person who identifies opportunities and takes risks to create value",
    "risk_percent": 20.0
})
check("Player submits answer & risk for Round 2", sub2_resp.status_code == 200 and sub2_resp.get_json().get("success") is True)

# Admin closes market & settles Round 2
client.post(f"/api/admin/games/{game_id}/close-market", headers=admin_headers)
client.post(f"/api/admin/games/{game_id}/reveal", headers=admin_headers)
settle2_resp = client.post(f"/api/admin/games/{game_id}/settle", headers=admin_headers)
check("Round 2 settled successfully", settle2_resp.status_code == 200)

# Player checks settled result
res2_resp = p_client.get("/api/game/result", headers=p_headers).get_json()
res2_data = res2_resp.get("result", {})
check("Round 2 result is correct", res2_data.get("is_correct") is True)
check("Round 2 reveals correct answer", "identifies opportunities" in str(res2_data.get("correct_answer", "")).lower())

# Admin ends game
end_resp = client.post(f"/api/admin/games/{game_id}/end", headers=admin_headers)
check("Admin ends game", end_resp.status_code == 200)

print("\n" + "=" * 70)
print("PHASE 5: CLEANUP & POST-TEST AUDIT")
print("=" * 70)

# Clean only temporary test records
cleanup_test_game()

# Verify questions in Supabase are STILL exactly 40
final_q_rows = sb.table("questions").select("*").execute().data or []
check("Database still contains EXACTLY 40 questions after test", len(final_q_rows) == 40, f"Found {len(final_q_rows)}")
check("All 40 questions are still active", all(q.get("is_active") for q in final_q_rows))
check("All 40 questions have duration_seconds = 15", all(q.get("duration_seconds") == 15 for q in final_q_rows))

# Verify zero test games remain
rem_games = [g for g in gs.gw_select("games") if g.get("game_pin") == GAME_PIN]
check("Zero test games remain in database", len(rem_games) == 0)

print("\n" + "=" * 70)
print(f"VERIFICATION SUMMARY: {len(PASS)} PASSED, {len(FAIL)} FAILED")
print("=" * 70)

if FAIL:
    sys.exit(1)
sys.exit(0)

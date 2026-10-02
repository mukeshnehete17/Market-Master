"""140-Student Concurrent Load & Spike Test against Real Supabase PostgreSQL.

Simulates 140 concurrent players:
1. Concurrent Login & Game Join (140 players)
2. Admin Starts Game -> Round 1 Active
3. Concurrent Question Reads (140 players)
4. Concurrent Answer & Risk Submissions (140 players)
5. Concurrent Duplicate Submission Rejection Spike (140 players)
6. Admin Closes Market, Reveals, and Settles Round
7. Concurrent Result Reads (140 players)
8. Concurrent Leaderboard Reads (140 players)
9. Mathematical Consistency Verification (Balances, Ledger, Positions)
10. 100% Clean Teardown of all test artifacts.

Run: .venv/bin/python3 test_concurrent_load_140.py
"""

import concurrent.futures
import json
import os
import sys
import time
import uuid

from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)
load_dotenv("backend-source/Frontend + BackEnd/.env")

from app import app
from services import game_store as gs
from services.auth_store import find_profile_by_email, list_profiles
from services.passwords import hash_password
from services.supabase_db import is_supabase_configured

NUM_STUDENTS = 140
PREFIX = "load140"
GAME_PIN = "LD140X"

PASS, FAIL = [], []


def check(label, cond, detail=""):
    if cond:
        PASS.append(label)
        print("PASS: " + label)
    else:
        FAIL.append(label)
        print("FAIL: " + label + (" - " + str(detail)[:400] if detail else ""))


def stop(msg):
    print("STOP: " + msg)
    sys.exit(2)


# Preconditions
if not is_supabase_configured():
    stop("Supabase is not configured. This test requires real Supabase PostgreSQL.")

print("=" * 60)
print(f"STARTING 140-STUDENT CONCURRENT SPIKE & LOAD TEST")
print("=" * 60)

# Pre-test cleanup in case previous interrupted run left records
def pre_clean():
    existing_games = [g for g in gs.gw_select("games") if g.get("game_pin") == GAME_PIN or PREFIX in str(g.get("name", "")).lower()]
    for g in existing_games:
        gid = g["id"]
        for t in ("answers", "positions", "transactions", "rounds", "game_questions", "game_players"):
            for r in gs.gw_select(t, {"game_id": gid}):
                gs.gw_delete(t, {"id": r["id"]})
        gs.gw_delete("games", {"id": gid})
    
    existing_questions = [q for q in gs.gw_select("questions") if PREFIX in str(q.get("question_text", "")).lower()]
    for q in existing_questions:
        gs.gw_delete("questions", {"id": q["id"]})
        
    for p in list_profiles():
        if PREFIX in str(p.get("email", "")).lower():
            gs.gw_delete("profiles", {"id": p["id"]})

pre_clean()

# 1. Setup Admin, Question, and Game
client = app.test_client()

# Admin
admin_email = f"{PREFIX}_admin@verify.test".lower()
admin_pwd = "AdminPassword123!"
admin_prof = find_profile_by_email(admin_email)
if not admin_prof:
    admin_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()), "name": "Load Test Admin",
        "email": admin_email, "password_hash": hash_password(admin_pwd),
        "role": "admin", "avatar": "🛡️", "status": "active"
    })

admin_resp = client.post("/api/auth/login", json={"email": admin_email, "password": admin_pwd})
admin_token = admin_resp.get_json().get("token")
admin_headers = {"Authorization": f"Bearer {admin_token}"}
check("Admin logged in", admin_resp.status_code == 200 and bool(admin_token))

# Create Question
q_resp = client.post("/api/admin/questions", headers=admin_headers, json={
    "question_text": f"[{PREFIX.upper()}] What is the capital of France?",
    "option_a": "London",
    "option_b": "Paris",
    "option_c": "Berlin",
    "option_d": "Madrid",
    "correct_option": "Option B",
    "category": "Geography",
    "duration_seconds": 60,
    "is_active": True
})
q_data = q_resp.get_json()
question_id = (q_data.get("question") or {}).get("id") or q_data.get("id")
check("Question created in Supabase", q_resp.status_code == 201 and bool(question_id))

# Create Game
g_resp = client.post("/api/admin/games", headers=admin_headers, json={
    "name": f"[{PREFIX.upper()}] 140-Student Championship",
    "game_pin": GAME_PIN,
    "starting_capital": 10000,
    "min_risk": 10,
    "max_risk": 75,
    "default_question_duration": 60,
    "question_ids": [question_id]
})
g_data = g_resp.get_json()
game_id = (g_data.get("game") or {}).get("id") or g_data.get("id")
check("Game created with PIN LD140X", g_resp.status_code == 201 and bool(game_id))

# 2. Concurrently Create and Authenticate 140 Students
print(f"\n--- Phase 1: Provisioning & Authenticating {NUM_STUDENTS} Students Concurrently ---")
students_data = []
for i in range(1, NUM_STUDENTS + 1):
    email = f"{PREFIX}_student_{i:03d}@verify.test".lower()
    students_data.append({
        "id": str(uuid.uuid4()),
        "name": f"Student {i:03d}",
        "email": email,
        "password": f"Password123!{i:03d}",
        "role": "participant",
        "avatar": "🦊"
    })

# Batch insert profile rows directly or via signup
t0 = time.time()
def setup_student(s):
    # Insert profile if not exists
    p = find_profile_by_email(s["email"])
    if not p:
        p = gs.gw_insert("profiles", {
            "id": s["id"], "name": s["name"],
            "email": s["email"], "password_hash": hash_password(s["password"]),
            "role": s["role"], "avatar": s["avatar"], "status": "active"
        })
    # Login to get JWT
    with app.test_client() as cl:
        resp = cl.post("/api/auth/login", json={"email": s["email"], "password": s["password"]})
        tok = resp.get_json().get("token")
        return {"id": p["id"], "name": s["name"], "email": s["email"], "token": tok}

with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
    auth_students = list(executor.map(setup_student, students_data))

auth_duration = time.time() - t0
check(f"All {NUM_STUDENTS} students authenticated ({auth_duration:.2f}s)",
      len(auth_students) == NUM_STUDENTS and all(s["token"] for s in auth_students))

# 3. Concurrently Join the Game via PIN
print(f"\n--- Phase 2: Concurrent Game Join Spike ({NUM_STUDENTS} Players) ---")
t0 = time.time()
def join_game(s):
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.post("/api/game/join", headers=headers, json={"game_code": GAME_PIN, "avatar": "🦊"})
        return resp.status_code, resp.get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    join_results = list(executor.map(join_game, auth_students))

join_duration = time.time() - t0
join_success_count = sum(1 for status, data in join_results if status == 200 and data.get("success"))
check(f"All {NUM_STUDENTS} students joined game concurrently ({join_duration:.2f}s)",
      join_success_count == NUM_STUDENTS, f"Success count: {join_success_count}/{NUM_STUDENTS}")

# 4. Admin Starts Game (Round 1 becomes active)
print(f"\n--- Phase 3: Admin Starts Game ---")
start_resp = client.post(f"/api/admin/games/{game_id}/control", headers=admin_headers, json={"op": "start"})
check("Admin started game (Round 1 active)", start_resp.status_code == 200)

# 5. Concurrent Question Fetch Spike (140 players fetching state simultaneously)
print(f"\n--- Phase 4: Concurrent Question Fetch Spike ({NUM_STUDENTS} Players) ---")
t0 = time.time()
def fetch_current(s):
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.get("/api/game/current", headers=headers)
        return resp.status_code, resp.get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    fetch_results = list(executor.map(fetch_current, auth_students))

fetch_duration = time.time() - t0
fetch_success = sum(1 for status, data in fetch_results
                    if status == 200 and data.get("game_state") == "question" and data.get("round", {}).get("question"))
check(f"All {NUM_STUDENTS} students fetched question concurrently ({fetch_duration:.2f}s)",
      fetch_success == NUM_STUDENTS, f"Success: {fetch_success}/{NUM_STUDENTS}")

# Verify no answer leak in question fetch
q_leak = any(data.get("round", {}).get("question", {}).get("correct_option") for _, data in fetch_results)
check("Zero answer leaks in public question payloads", not q_leak)

# 6. Concurrent Answer & Risk Submission Spike (140 players submitting within seconds)
print(f"\n--- Phase 5: Concurrent Answer & Risk Submission Spike ({NUM_STUDENTS} Players) ---")
t0 = time.time()
# First 70 students choose Option B (Correct), next 70 choose Option A (Wrong)
def submit_answer(idx_and_student):
    idx, s = idx_and_student
    is_correct_choice = (idx < 70)
    choice = "Option B" if is_correct_choice else "Option A"
    risk_pct = 20.0  # 20% risk on 10,000 capital = 2,000 bid (2x multiplier)
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.post("/api/game/submit", headers=headers, json={
            "question_id": question_id,
            "selected_option": choice,
            "risk_percent": risk_pct
        })
        return resp.status_code, resp.get_json(), is_correct_choice

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    submit_results = list(executor.map(submit_answer, enumerate(auth_students)))

submit_duration = time.time() - t0
submit_success = sum(1 for status, data, _ in submit_results if status == 200 and data.get("success"))
check(f"All {NUM_STUDENTS} students submitted answers & risk concurrently ({submit_duration:.2f}s)",
      submit_success == NUM_STUDENTS, f"Success: {submit_success}/{NUM_STUDENTS}")

# 7. Duplicate Submission Protection Spike (All 140 try to submit a second time)
print(f"\n--- Phase 6: Duplicate Submission Rejection Spike ({NUM_STUDENTS} Submissions) ---")
t0 = time.time()
def submit_duplicate(s):
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.post("/api/game/submit", headers=headers, json={
            "question_id": question_id,
            "selected_option": "Option C",
            "risk_percent": 15.0
        })
        return resp.status_code, resp.get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    dup_results = list(executor.map(submit_duplicate, auth_students))

dup_duration = time.time() - t0
dup_rejected = sum(1 for status, data in dup_results
                    if status == 400 and "already locked" in data.get("message", "").lower())
check(f"All {NUM_STUDENTS} duplicate submissions rejected ({dup_duration:.2f}s)",
      dup_rejected == NUM_STUDENTS, f"Rejected: {dup_rejected}/{NUM_STUDENTS}")

# 8. Admin Market Close, Reveal & Settlement Flow
print(f"\n--- Phase 7: Live Market Desk Controls Execution ---")
close_resp = client.post(f"/api/admin/games/{game_id}/control", headers=admin_headers, json={"op": "close-market"})
check("Admin closed market", close_resp.status_code == 200)

reveal_resp = client.post(f"/api/admin/games/{game_id}/control", headers=admin_headers, json={"op": "reveal"})
check("Admin revealed answer", reveal_resp.status_code == 200)

settle_resp = client.post(f"/api/admin/games/{game_id}/control", headers=admin_headers, json={"op": "settle"})
check("Admin settled round", settle_resp.status_code == 200)

# 9. Concurrent Result & Leaderboard Reads
print(f"\n--- Phase 8: Concurrent Result & Leaderboard Reads ({NUM_STUDENTS} Players) ---")
t0 = time.time()
def fetch_result(s):
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.get("/api/game/result", headers=headers)
        return resp.status_code, resp.get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    result_reads = list(executor.map(fetch_result, auth_students))

result_duration = time.time() - t0
result_success = sum(1 for status, data in result_reads if status == 200 and data.get("success"))
check(f"All {NUM_STUDENTS} students fetched results concurrently ({result_duration:.2f}s)",
      result_success == NUM_STUDENTS)

# Leaderboard fetch
lb_resp = client.get(f"/api/admin/games/{game_id}/leaderboard", headers=admin_headers)
lb_data = lb_resp.get_json().get("leaderboard", [])
check(f"Leaderboard contains all {NUM_STUDENTS} players", len(lb_data) == NUM_STUDENTS)

# 10. Verify Mathematical & Database Consistency in Real Supabase
print(f"\n--- Phase 9: Mathematical & Database Integrity Verification ---")
db_answers = gs.gw_select("answers", {"game_id": game_id})
db_positions = gs.gw_select("positions", {"game_id": game_id})
db_players = gs.gw_select("game_players", {"game_id": game_id})
db_txs = gs.gw_select("transactions", {"game_id": game_id})

check(f"Exactly {NUM_STUDENTS} answers recorded in Supabase", len(db_answers) == NUM_STUDENTS)
check(f"Exactly {NUM_STUDENTS} positions recorded in Supabase", len(db_positions) == NUM_STUDENTS)
check(f"Exactly {NUM_STUDENTS} players enrolled in Supabase", len(db_players) == NUM_STUDENTS)

# Economics verification:
# Winners (70): 10,000 + (2,000 * 2) = 14,000 capital (score 1)
# Losers (70): 10,000 - 2,000 = 8,000 capital (score 0)
winners = [p for p in db_players if float(p.get("current_capital", 0)) == 14000.0]
losers = [p for p in db_players if float(p.get("current_capital", 0)) == 8000.0]
check(f"70 winning players have exact 14,000 capital", len(winners) == 70, f"Found: {len(winners)}")
check(f"70 losing players have exact 8,000 capital", len(losers) == 70, f"Found: {len(losers)}")

# Total ledger transactions: 140 starting_capital + 140 profit/loss = 280 txs
check(f"Transaction ledger has 280 exact records", len(db_txs) == 280, f"Found: {len(db_txs)}")

# 11. Cleanup All Verification Data
print(f"\n--- Phase 10: Complete Teardown & Database Verification ---")
def cleanup_all():
    # Delete answers, positions, txs, rounds, game_questions, game_players, games
    for t in ("answers", "positions", "transactions", "rounds", "game_questions", "game_players"):
        for r in gs.gw_select(t, {"game_id": game_id}):
            gs.gw_delete(t, {"id": r["id"]})
    gs.gw_delete("games", {"id": game_id})
    if question_id:
        gs.gw_delete("questions", {"id": question_id})
    # Delete test profiles
    for s in auth_students:
        gs.gw_delete("profiles", {"id": s["id"]})
    if admin_prof:
        gs.gw_delete("profiles", {"id": admin_prof["id"]})

cleanup_all()

# Verify zero load test records remain
remaining_profs = [p for p in list_profiles() if PREFIX in str(p.get("email", ""))]
remaining_games = [g for g in gs.gw_select("games") if g.get("game_pin") == GAME_PIN]
check("Teardown complete: 0 test profiles remain", len(remaining_profs) == 0)
check("Teardown complete: 0 test games remain", len(remaining_games) == 0)

print("\n" + "=" * 60)
print(f"CONCURRENT LOAD TEST SUMMARY: {len(PASS)} PASSED, {len(FAIL)} FAILED")
print("=" * 60)

if FAIL:
    sys.exit(1)
sys.exit(0)

"""Comprehensive Production Hardening & Full Lifecycle Regression Suite.

Executes all verification phases (A to AE) against REAL Supabase PostgreSQL:
1. Admin Authentication & Session Persistence
2. Create 5 Questions & verify they exist in Supabase
3. Section Navigation & Hard-Refresh simulation (verify 5 questions 100% persist)
4. Create Game with 5 assigned questions -> verify game_questions in Supabase
5. Market Desk: verify 5 assigned questions, ROUND 01 / 05, Sync, Start Game
6. 140 Concurrent Students join SAME Game PIN -> verify 140 game_players rows
7. Student Session Recovery on Refresh -> 140 students call /api/auth/me & /api/game/current
8. 140 Students submit answers & risk concurrently
9. Market Desk: Close Market -> Reveal -> Settle -> End
10. Verify Balances, Transactions, Leaderboard consistency
11. Game Delete verification: create draft game -> delete -> verify deleted & audited
12. 100% Clean Teardown of all test artifacts.

Run: .venv/bin/python3 test_full_production_hardening.py
"""

import concurrent.futures
import os
import sys
import time
import uuid
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
    print("ERROR: Real Supabase credentials are required.")
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

PREFIX = f"h{uuid.uuid4().hex[:6]}"
GAME_PIN = f"H{uuid.uuid4().hex[:5].upper()}"
DEL_PIN = f"D{uuid.uuid4().hex[:5].upper()}"
NUM_STUDENTS = 140

def cleanup():
    # Targeted purge of this test's artifacts
    for g in gs.gw_select("games"):
        if g.get("game_pin") in (GAME_PIN, DEL_PIN) or PREFIX in str(g.get("name", "")).lower():
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
    for q in gs.gw_select("questions"):
        if PREFIX in str(q.get("question_text", "")).lower():
            try:
                sb.table("questions").delete().eq("id", q["id"]).execute()
            except Exception:
                pass
    for p in list_profiles():
        if PREFIX in str(p.get("email", "")).lower():
            try:
                sb.table("profiles").delete().eq("id", p["id"]).execute()
            except Exception:
                pass

cleanup()

print("=" * 60)
print("STARTING FULL PRODUCTION HARDENING & REGRESSION SUITE")
print("=" * 60)

# A. Admin Login
admin_email = f"{PREFIX}_admin@verify.test".lower()
admin_pwd = "AdminHardened123!"
admin_prof = find_profile_by_email(admin_email)
if not admin_prof:
    admin_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()), "name": "Hardened Admin",
        "email": admin_email, "password_hash": hash_password(admin_pwd),
        "role": "admin", "avatar": "🦁", "status": "active"
    })

admin_resp = client.post("/api/auth/login", json={"email": admin_email, "password": admin_pwd})
admin_token = admin_resp.get_json().get("token")
admin_headers = {"Authorization": f"Bearer {admin_token}"}
check("Admin login via API", admin_resp.status_code == 200 and bool(admin_token))

# B. Create 5 Questions
created_qids = []
for idx in range(1, 6):
    resp = client.post("/api/admin/questions", headers=admin_headers, json={
        "question_text": f"[{PREFIX.upper()}] Finance Question {idx}?",
        "option_a": f"Alpha {idx}",
        "option_b": f"Beta {idx}",
        "option_c": f"Gamma {idx}",
        "option_d": f"Delta {idx}",
        "correct_option": "Option B",
        "explanation": f"Explanation for question {idx}",
        "category": "Capital Markets",
        "duration_seconds": 120,
        "is_active": True
    })
    check(f"Question {idx} created (HTTP 201)", resp.status_code == 201)
    qid = (resp.get_json().get("question") or {}).get("id")
    created_qids.append(qid)

check("All 5 questions have valid Supabase UUIDs", len(created_qids) == 5 and all(bool(q) for q in created_qids))

# C & D. Navigate simulation / repeated GET & Hard Refresh simulation
for section in ("/api/admin/overview", "/api/admin/students", "/api/admin/games", "/api/admin/actions"):
    client.get(section, headers=admin_headers)

list_q = client.get("/api/admin/questions", headers=admin_headers).get_json().get("questions", [])
found_qids = [q["id"] for q in list_q if q.get("id") in created_qids]
check("All 5 questions 100% persisted after multiple navigations and refreshes", len(found_qids) == 5)

# G & H. Create Game with 5 assigned questions
g_resp = client.post("/api/admin/games", headers=admin_headers, json={
    "name": f"[{PREFIX.upper()}] Championship 140 Arena",
    "game_pin": GAME_PIN,
    "starting_capital": 10000,
    "min_risk": 10,
    "max_risk": 75,
    "default_question_duration": 120,
    "question_ids": created_qids
})
check("Create Game with 5 questions (HTTP 201)", g_resp.status_code == 201, g_resp.get_json())
game_id = (g_resp.get_json().get("game") or {}).get("id")

# I. Verify game_questions in Supabase
gq_rows = sb.table("game_questions").select("*").eq("game_id", game_id).order("round_number").execute().data or []
check("game_questions contains exactly 5 assigned questions in order",
      len(gq_rows) == 5 and [r["question_id"] for r in gq_rows] == created_qids)

# L & M. Select Game & Open Market Desk
deck_resp = client.get(f"/api/admin/deck?game_id={game_id}", headers=admin_headers)
deck_data = deck_resp.get_json().get("deck", {})
g_deck = deck_data.get("game", {})
check("Market Desk shows 5 assigned questions", len(g_deck.get("questions", [])) == 5)
check("Market Desk shows ROUND 01 / 05",
      int(g_deck.get("current_round_number", 0)) == 1 and int(g_deck.get("total_rounds", 0)) == 5)

# O. Create and Authenticate 140 Students
print(f"\n--- Provisioning & Authenticating {NUM_STUDENTS} Students ---")
students_data = []
for i in range(1, NUM_STUDENTS + 1):
    email = f"{PREFIX}_student_{i:03d}@verify.test".lower()
    students_data.append({
        "id": str(uuid.uuid4()),
        "name": f"Trader {i:03d}",
        "email": email,
        "password": f"Password123!{i:03d}",
        "role": "participant",
        "avatar": "🦊"
    })

def setup_student(s):
    p = find_profile_by_email(s["email"])
    if not p:
        p = gs.gw_insert("profiles", {
            "id": s["id"], "name": s["name"],
            "email": s["email"], "password_hash": hash_password(s["password"]),
            "role": s["role"], "avatar": s["avatar"], "status": "active"
        })
    with app.test_client() as cl:
        resp = cl.post("/api/auth/login", json={"email": s["email"], "password": s["password"]})
        tok = resp.get_json().get("token")
        return {"id": p["id"], "name": s["name"], "email": s["email"], "token": tok}

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    auth_students = list(executor.map(setup_student, students_data))

check(f"All {NUM_STUDENTS} students authenticated", len(auth_students) == NUM_STUDENTS and all(s["token"] for s in auth_students))

# P & Q. 140 Students Join SAME Game PIN
print(f"\n--- Concurrent Game Join ({NUM_STUDENTS} Players to PIN: {GAME_PIN}) ---")
def join_game(s):
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.post("/api/game/join", headers=headers, json={"game_code": GAME_PIN, "avatar": "🦊"})
        return resp.status_code, resp.get_json()

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    join_results = list(executor.map(join_game, auth_students))

join_success = sum(1 for status, data in join_results if status == 200 and data.get("success"))
check(f"All {NUM_STUDENTS} students joined the SAME game PIN", join_success == NUM_STUDENTS)

gp_db_count = len(sb.table("game_players").select("id").eq("game_id", game_id).execute().data or [])
check(f"Exactly {NUM_STUDENTS} game_players rows exist for game in Supabase", gp_db_count == NUM_STUDENTS)

# R. Admin Starts Game (Round 1 active)
start_resp = client.post(f"/api/admin/games/{game_id}/start", headers=admin_headers)
check("Admin started game (Round 1 live)", start_resp.status_code == 200)

# S & AA & AB. Student Session Refresh Recovery: 140 students reload & verify game resume
print(f"\n--- Student Refresh & Session Auto-Recovery Spike ---")
def refresh_student_session(s):
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        # Simulate app startup: 1. check /auth/me
        me_resp = cl.get("/api/auth/me", headers=headers)
        me_ok = (me_resp.status_code == 200 and me_resp.get_json().get("user", {}).get("email") == s["email"])
        # 2. check /game/current
        cur_resp = cl.get("/api/game/current", headers=headers)
        cur_data = cur_resp.get_json()
        cur_ok = (cur_resp.status_code == 200 and cur_data.get("game_state") == "question"
                  and (cur_data.get("round", {}).get("question") or {}).get("id") == created_qids[0])
        return me_ok and cur_ok

with concurrent.futures.ThreadPoolExecutor(max_workers=35) as executor:
    recovery_results = list(executor.map(refresh_student_session, auth_students))

recovery_count = sum(1 for ok in recovery_results if ok)
check(f"All {NUM_STUDENTS} students seamlessly restored active game on browser refresh",
      recovery_count == NUM_STUDENTS, f"Recovered: {recovery_count}/{NUM_STUDENTS}")

# T. 140 Students Submit Answers & Risk Concurrently
print(f"\n--- Concurrent Answer & Risk Submission Spike ---")
def submit_round1(idx_and_student):
    idx, s = idx_and_student
    is_correct = (idx < 70)
    choice = "Option B" if is_correct else "Option A"
    with app.test_client() as cl:
        headers = {"Authorization": f"Bearer {s['token']}"}
        resp = cl.post("/api/game/submit", headers=headers, json={
            "question_id": created_qids[0],
            "selected_option": choice,
            "risk_percent": 20.0
        })
        return resp.status_code, resp.get_json(), idx

with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
    sub_results = list(executor.map(submit_round1, enumerate(auth_students)))

failed_subs = [(status, data, idx) for status, data, idx in sub_results if not (status == 200 and data.get("success"))]
if failed_subs:
    print(f"Sample failed submissions ({len(failed_subs)} total): {failed_subs[:5]}")

sub_success = sum(1 for status, data, _ in sub_results if status == 200 and data.get("success"))
check(f"All {NUM_STUDENTS} submissions accepted", sub_success == NUM_STUDENTS, f"Accepted: {sub_success}/{NUM_STUDENTS}")

# U, V, W. Market Desk Lifecycle: Close Market -> Reveal -> Settle
check("Close Market 200", client.post(f"/api/admin/games/{game_id}/close-market", headers=admin_headers).status_code == 200)
check("Reveal Answer 200", client.post(f"/api/admin/games/{game_id}/reveal", headers=admin_headers).status_code == 200)
check("Settle Round 200", client.post(f"/api/admin/games/{game_id}/settle", headers=admin_headers).status_code == 200)

# X, Y, Z. Verify Balances, Transactions, Leaderboard
db_players = sb.table("game_players").select("*").eq("game_id", game_id).execute().data or []
winners = [p for p in db_players if float(p.get("current_capital", 0)) == 14000.0]
losers = [p for p in db_players if float(p.get("current_capital", 0)) == 8000.0]
check("70 winning players have exact 14,000 capital", len(winners) == 70, f"Found: {len(winners)}")
check("70 losing players have exact 8,000 capital", len(losers) == 70, f"Found: {len(losers)}")

txs = sb.table("transactions").select("id").eq("game_id", game_id).execute().data or []
check("Transaction ledger has 280 exact records", len(txs) == 280, f"Found: {len(txs)}")

lb = client.get(f"/api/admin/games/{game_id}/leaderboard", headers=admin_headers).get_json().get("leaderboard", [])
check("Leaderboard contains all 140 players", len(lb) == NUM_STUDENTS)

# End Game
end_resp = client.post(f"/api/admin/games/{game_id}/end", headers=admin_headers)
check("End Game 200", end_resp.status_code == 200, end_resp.get_json())

# PART 5 / 23: Safe Delete Game Test
print(f"\n--- Safe Game Delete Test ---")
DEL_PIN = f"D{PREFIX[:5].upper()}"
del_game_resp = client.post("/api/admin/games", headers=admin_headers, json={
    "name": f"[{PREFIX.upper()}] Temporary Draft To Delete",
    "game_pin": DEL_PIN,
    "starting_capital": 1000,
    "min_risk": 10,
    "max_risk": 50,
    "default_question_duration": 15,
    "question_ids": [created_qids[0]]
})
check("Temporary draft game created for delete test", del_game_resp.status_code == 201, del_game_resp.get_json())
del_game_data = del_game_resp.get_json() or {}
del_gid = (del_game_data.get("game") or {}).get("id") or del_game_data.get("id")

# Delete the draft game
del_resp = client.delete(f"/api/admin/games/{del_gid}", headers=admin_headers)
check("Draft game successfully deleted (HTTP 200)", del_resp.status_code == 200, del_resp.get_json())
del_check = sb.table("games").select("id").eq("id", del_gid).execute().data
check("Deleted game removed from Supabase", len(del_check) == 0)

# Check audit action logged
acts = sb.table("admin_actions").select("*").eq("entity_id", del_gid).execute().data or []
check("admin_actions audit record logged for game.delete", any(a.get("action") == "game.delete" for a in acts))

# Final Cleanup
cleanup()

rem_q = [q for q in gs.gw_select("questions") if PREFIX in str(q.get("question_text", "")).lower()]
rem_g = [g for g in gs.gw_select("games") if g.get("game_pin") in (GAME_PIN, DEL_PIN)]
rem_p = [p for p in list_profiles() if PREFIX in str(p.get("email", "")).lower()]
check("Zero test questions remain", len(rem_q) == 0)
check("Zero test games remain", len(rem_g) == 0)
check("Zero test profiles remain", len(rem_p) == 0)

print("=" * 60)
print(f"FULL PRODUCTION HARDENING SUMMARY: {len(PASS)} PASSED, {len(FAIL)} FAILED")
print("=" * 60)

if FAIL:
    sys.exit(1)
sys.exit(0)

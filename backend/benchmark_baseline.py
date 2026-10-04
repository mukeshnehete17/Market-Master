"""Performance Baseline Measurement Script for Market Master.

Measures latency and query count across critical operations.
"""
import os
import sys
import time
import uuid
import statistics

from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)

from app import app
from services import game_store as gs
from services.auth_store import find_profile_by_email, list_profiles
from services.passwords import hash_password
from services.supabase_db import is_supabase_configured

client = app.test_client()

# Setup test admin
PREFIX = "perf_base"
admin_email = f"{PREFIX}_admin@benchmark.test".lower()
admin_pwd = "AdminBenchmark123!"

admin_prof = find_profile_by_email(admin_email)
if not admin_prof:
    admin_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()),
        "name": "Benchmark Admin",
        "email": admin_email,
        "password_hash": hash_password(admin_pwd),
        "role": "admin",
        "avatar": "⚡",
        "status": "active"
    })

def measure(label, fn, runs=3):
    durations = []
    res = None
    for _ in range(runs):
        t0 = time.time()
        res = fn()
        durations.append((time.time() - t0) * 1000)
    avg = statistics.mean(durations)
    p50 = statistics.median(durations)
    print(f"{label:<35} | avg: {avg:6.1f}ms | min: {min(durations):6.1f}ms | p50: {p50:6.1f}ms | max: {max(durations):6.1f}ms")
    return res, avg

print("=" * 75)
print(f"MARKET MASTER PERFORMANCE BASELINE PROFILING (Supabase={is_supabase_configured()})")
print("=" * 75)

# 1. Login
_, t_login = measure("1. Admin Login", lambda: client.post("/api/auth/login", json={"email": admin_email, "password": admin_pwd}))
admin_token = client.post("/api/auth/login", json={"email": admin_email, "password": admin_pwd}).get_json()["token"]
headers = {"Authorization": f"Bearer {admin_token}"}

# 2. Admin overview
_, t_overview = measure("2. Admin Overview (/overview)", lambda: client.get("/api/admin/overview", headers=headers))

# 3. List questions
_, t_questions = measure("3. Question Bank (/questions)", lambda: client.get("/api/admin/questions", headers=headers))

# 4. List games
_, t_games = measure("4. Games List (/games)", lambda: client.get("/api/admin/games", headers=headers))

# 5. List students
_, t_students = measure("5. Students List (/students)", lambda: client.get("/api/admin/students", headers=headers))

# 6. Create Question
created_q_id = None
def create_q():
    global created_q_id
    r = client.post("/api/admin/questions", headers=headers, json={
        "question_text": f"Benchmark Q {uuid.uuid4().hex[:6]}",
        "option_a": "Opt A", "option_b": "Opt B", "option_c": "Opt C", "option_d": "Opt D",
        "correct_option": "A", "category": "Crypto", "duration_seconds": 15
    })
    data = r.get_json()
    if data and data.get("question"):
        created_q_id = data["question"]["id"]
    return r

_, t_create_q = measure("6. Create Question (POST)", create_q, runs=1)

# 7. Create Game
created_game_id = None
created_game_pin = None
def create_game():
    global created_game_id, created_game_pin
    r = client.post("/api/admin/games", headers=headers, json={
        "name": f"Benchmark Game {uuid.uuid4().hex[:6]}",
        "starting_capital": 10000, "min_risk": 10, "max_risk": 75, "default_question_duration": 15,
        "question_ids": [created_q_id] if created_q_id else []
    })
    data = r.get_json()
    if data and data.get("game"):
        created_game_id = data["game"]["id"]
        created_game_pin = data["game"]["game_pin"]
    return r

_, t_create_g = measure("7. Create Game (POST)", create_game, runs=1)

# 8. Control Deck
_, t_deck = measure("8. Control Deck (/deck?game_id)", lambda: client.get(f"/api/admin/deck?game_id={created_game_id}", headers=headers))

# 9. Student Join
student_email = f"{PREFIX}_stu_{uuid.uuid4().hex[:4]}@bench.test"
student_pwd = "Password123!"
reg_res = client.post("/api/auth/signup", json={
    "name": "Benchmark Student", "email": student_email,
    "password": student_pwd, "confirm_password": student_pwd
})
stu_token = reg_res.get_json()["token"]
stu_headers = {"Authorization": f"Bearer {stu_token}"}

_, t_join = measure("9. Student Join Game (POST)", lambda: client.post("/api/game/join", headers=stu_headers, json={"game_pin": created_game_pin}), runs=1)

# 10. Start Game
_, t_start = measure("10. Start Game (POST)", lambda: client.post(f"/api/admin/games/{created_game_id}/start", headers=headers), runs=1)

# 11. Student Current State
_, t_current = measure("11. Student Current Question", lambda: client.get("/api/game/current", headers=stu_headers))

# 12. Student Submit Answer
_, t_submit = measure("12. Student Submit Answer", lambda: client.post("/api/game/submit", headers=stu_headers, json={
    "game_pin": created_game_pin, "selected_option": "A", "risk_percent": 25
}), runs=1)

# 13. Close Market
_, t_close = measure("13. Close Market (POST)", lambda: client.post(f"/api/admin/games/{created_game_id}/close-market", headers=headers), runs=1)

# 14. Reveal Answer
_, t_reveal = measure("14. Reveal Answer (POST)", lambda: client.post(f"/api/admin/games/{created_game_id}/reveal", headers=headers), runs=1)

# 15. Settle Round
_, t_settle = measure("15. Settle Round (POST)", lambda: client.post(f"/api/admin/games/{created_game_id}/settle", headers=headers), runs=1)

# Cleanup
if created_game_id:
    for t in ("answers", "positions", "transactions", "rounds", "game_questions", "game_players"):
        for r in gs.gw_select(t, {"game_id": created_game_id}):
            gs.gw_delete(t, {"id": r["id"]})
    gs.gw_delete("games", {"id": created_game_id})
if created_q_id:
    gs.gw_delete("questions", {"id": created_q_id})
if admin_prof:
    gs.gw_delete("profiles", {"id": admin_prof["id"]})
for p in list_profiles():
    if PREFIX in str(p.get("email", "")):
        gs.gw_delete("profiles", {"id": p["id"]})

print("=" * 75)
print("BENCHMARK COMPLETED")

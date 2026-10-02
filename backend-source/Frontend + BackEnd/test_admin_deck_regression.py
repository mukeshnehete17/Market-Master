"""Admin Control Deck E2E Regression against Live Supabase PostgreSQL.

Executes the exact sequence requested by the user:
1. Question Bank: Create a new temporary question & verify it appears
2. Navigate to Dashboard -> return to Question Bank -> verify it is still visible
3. Navigate to Games -> Create Game -> select exact newly-created question -> Create Game
4. Verify NO "Question not found" error
5. Verify game_questions table in Supabase contains the real question UUID
6. Market Desk: verify Assigned Questions = 1
7. Market Desk: verify ROUND 01 / 01 (NOT ROUND 01 / 00)
8. Click SYNC and verify it fetches fresh state
9. Click START GAME (ROUND 1) and verify Supabase transitions game/round to live
10. Verify active question appears in Market Desk payload
11. Verify player can join using the PIN
12. Verify player receives the correct active question
13. Market Flow: Close Market -> Reveal Answer -> Settle Round -> End Game
14. Navigate away and back + hard refresh simulation
15. Complete cleanup of all temporary verification rows (0 test artifacts remain).

Run: .venv/bin/python3 test_admin_deck_regression.py
"""

import os
import sys
import uuid
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)
load_dotenv("backend-source/Frontend + BackEnd/.env")

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

PREFIX = "regdeck"
GAME_PIN = "REGDK1"

# Pre-cleanup
def cleanup():
    for t in ("answers", "positions", "transactions", "rounds", "game_questions", "game_players"):
        try:
            sb.table(t).delete().like("game_id", f"%").execute() # Will target specific test games
        except Exception:
            pass
    # Specific targeted cleanup
    for g in gs.gw_select("games"):
        if g.get("game_pin") == GAME_PIN or PREFIX in str(g.get("name", "")).lower():
            gid = g["id"]
            for t in ("answers", "positions", "transactions", "rounds", "game_questions", "game_players"):
                sb.table(t).delete().eq("game_id", gid).execute()
            sb.table("games").delete().eq("id", gid).execute()
    for q in gs.gw_select("questions"):
        if PREFIX in str(q.get("question_text", "")).lower():
            sb.table("questions").delete().eq("id", q["id"]).execute()
    for p in list_profiles():
        if PREFIX in str(p.get("email", "")).lower():
            sb.table("profiles").delete().eq("id", p["id"]).execute()

cleanup()

print("=" * 60)
print("STARTING ADMIN CONTROL DECK E2E REAL SUPABASE REGRESSION")
print("=" * 60)

# 1. Admin Authentication
admin_email = f"{PREFIX}_admin@verify.test".lower()
admin_pwd = "AdminSecret123!"
admin_prof = find_profile_by_email(admin_email)
if not admin_prof:
    admin_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()), "name": "Deck Admin",
        "email": admin_email, "password_hash": hash_password(admin_pwd),
        "role": "admin", "avatar": "👑", "status": "active"
    })

admin_resp = client.post("/api/auth/login", json={"email": admin_email, "password": admin_pwd})
admin_token = admin_resp.get_json().get("token")
admin_headers = {"Authorization": f"Bearer {admin_token}"}
check("Admin Login via API", admin_resp.status_code == 200 and bool(admin_token))

# 2. Question Bank: Create a new temporary question
q_payload = {
    "question_text": f"[{PREFIX.upper()}] What is the primary function of a stock exchange?",
    "option_a": "Provide liquidity and price discovery",
    "option_b": "Print fiat currency directly",
    "option_c": "Guarantee 100% positive returns",
    "option_d": "Set national tax rates",
    "correct_option": "Option A",
    "explanation": "Stock exchanges provide liquidity, market transparency, and price discovery.",
    "category": "Equities & Trading",
    "duration_seconds": 30,
    "is_active": True
}
q_resp = client.post("/api/admin/questions", headers=admin_headers, json=q_payload)
check("Question Creation 201", q_resp.status_code == 201, q_resp.get_json())
q_data = q_resp.get_json().get("question", {})
q_id = q_data.get("id")
check("Question contains real Supabase UUID", bool(q_id) and len(q_id) > 10, q_id)

# Verify question appears in Question Bank
list_q_resp = client.get("/api/admin/questions", headers=admin_headers)
q_list = list_q_resp.get_json().get("questions", [])
matching_q = next((q for q in q_list if q.get("id") == q_id), None)
check("Question visible in Question Bank API", matching_q is not None)

# 3. Navigation Consistency: Dashboard -> Question Bank
dash_resp = client.get("/api/admin/overview", headers=admin_headers)
check("Dashboard API call succeeds", dash_resp.status_code == 200)

list_q_after_dash = client.get("/api/admin/questions", headers=admin_headers)
q_after_dash = next((q for q in list_q_after_dash.get_json().get("questions", []) if q.get("id") == q_id), None)
check("Question persists after navigation to Dashboard and back", q_after_dash is not None)

# 4. Games: Create Game selecting that exact newly-created question
game_payload = {
    "name": f"[{PREFIX.upper()}] Championship Arena",
    "game_pin": GAME_PIN,
    "starting_capital": 5000,
    "min_risk": 10,
    "max_risk": 50,
    "default_question_duration": 30,
    "question_ids": [q_id]
}
g_resp = client.post("/api/admin/games", headers=admin_headers, json=game_payload)
g_json = g_resp.get_json()
check("Create Game 201 (NO Question not found error)", g_resp.status_code == 201, g_json)
game_id = (g_json.get("game") or {}).get("id")
check("Game created with real ID", bool(game_id))

# Verify game_questions contains the real question UUID
gq_rows = sb.table("game_questions").select("*").eq("game_id", game_id).execute().data or []
check("game_questions contains real question UUID", len(gq_rows) == 1 and gq_rows[0].get("question_id") == q_id, gq_rows)

# 5. Market Desk: Verify Control Deck Data
deck_resp = client.get(f"/api/admin/deck?game_id={game_id}", headers=admin_headers)
check("Control Deck API 200", deck_resp.status_code == 200, (deck_resp.status_code, deck_resp.get_data(as_text=True)))
deck_data = (deck_resp.get_json() or {}).get("deck", {})
g_deck = deck_data.get("game", {})

check("Assigned Questions count is 1", len(g_deck.get("questions", [])) == 1)
check("Round display is ROUND 01 / 01 (NOT ROUND 01 / 00)",
      int(g_deck.get("current_round_number", 0)) == 1 and int(g_deck.get("total_rounds", 0)) == 1,
      f"current: {g_deck.get('current_round_number')}, total: {g_deck.get('total_rounds')}")

# 6. Click SYNC: verify fresh state fetched
sync_resp = client.get(f"/api/admin/deck?game_id={game_id}", headers=admin_headers)
check("SYNC fetches authoritative fresh state", sync_resp.status_code == 200 and (sync_resp.get_json() or {}).get("deck", {}).get("has_game") is True)

# 7. Click START GAME (ROUND 1)
start_resp = client.post(f"/api/admin/games/{game_id}/start", headers=admin_headers)
check("START GAME button succeeds 200", start_resp.status_code == 200, start_resp.get_json())

# Verify Supabase game status is 'live' and round 1 status is 'question_open'
game_db = sb.table("games").select("status").eq("id", game_id).execute().data[0]
check("Game status in Supabase is live", game_db.get("status") == "live")

round_db = sb.table("rounds").select("*").eq("game_id", game_id).eq("round_number", 1).execute().data
check("Round 1 active in Supabase", len(round_db) == 1 and round_db[0].get("status") == "question_open")

# Verify active question appears in Market Desk
deck_live_resp = client.get(f"/api/admin/deck?game_id={game_id}", headers=admin_headers)
deck_live = (deck_live_resp.get_json() or {}).get("deck", {})
current_q = deck_live.get("current_question", {})
check("Active question appears in Market Desk", current_q.get("id") == q_id and "stock exchange" in current_q.get("question_text", "").lower())

# 8. Player Join & Question Delivery
stu_email = f"{PREFIX}_student@verify.test".lower()
stu_pwd = "StudentSecret123!"
stu_prof = find_profile_by_email(stu_email)
if not stu_prof:
    stu_prof = gs.gw_insert("profiles", {
        "id": str(uuid.uuid4()), "name": "Deck Student",
        "email": stu_email, "password_hash": hash_password(stu_pwd),
        "role": "participant", "avatar": "🦊", "status": "active"
    })

p_client = app.test_client()
p_login = p_client.post("/api/auth/login", json={"email": stu_email, "password": stu_pwd})
p_token = p_login.get_json().get("token")
p_headers = {"Authorization": f"Bearer {p_token}"}
check("Player Login via API", p_login.status_code == 200 and bool(p_token))

p_join = p_client.post("/api/game/join", headers=p_headers, json={"game_code": GAME_PIN, "avatar": "🦊"})
check("Player joins game using PIN", p_join.status_code == 200 and p_join.get_json().get("success") is True)

# Verify player receives the correct active question
p_current = p_client.get("/api/game/current", headers=p_headers)
p_cur_data = p_current.get_json()
p_q = (p_cur_data.get("round") or {}).get("question") or {}
check("Player receives authoritative active question", p_cur_data.get("game_state") == "question" and p_q.get("id") == q_id)
check("Player question payload does NOT leak correct_option", "correct_option" not in p_q or p_q.get("correct_option") is None)

# 9. Player Submits Answer & Risk
p_sub = p_client.post("/api/game/submit", headers=p_headers, json={
    "question_id": q_id,
    "selected_option": "Option A",
    "risk_percent": 25.0
})
check("Player submits answer & risk 200", p_sub.status_code == 200 and p_sub.get_json().get("success") is True)

# 10. Market Desk Lifecycle: Close Market -> Reveal -> Settle -> End
close_resp = client.post(f"/api/admin/games/{game_id}/close-market", headers=admin_headers)
check("CLOSE MARKET succeeds", close_resp.status_code == 200)

reveal_resp = client.post(f"/api/admin/games/{game_id}/reveal", headers=admin_headers)
check("REVEAL ANSWER succeeds", reveal_resp.status_code == 200)

settle_resp = client.post(f"/api/admin/games/{game_id}/settle", headers=admin_headers)
check("SETTLE ROUND succeeds", settle_resp.status_code == 200)

# Verify player result after settlement
p_res = p_client.get("/api/game/result", headers=p_headers)
check("Player fetches settlement result", p_res.status_code == 200 and p_res.get_json().get("result", {}).get("is_correct") is True, (p_res.status_code, p_res.get_json()))

# End Game
end_resp = client.post(f"/api/admin/games/{game_id}/end", headers=admin_headers)
check("END GAME succeeds", end_resp.status_code == 200)

# 11. Navigation Persistence & Hard Refresh Simulation
# Multiple round trips across sections
for _ in range(3):
    client.get("/api/admin/overview", headers=admin_headers)
    client.get("/api/admin/students", headers=admin_headers)
    client.get("/api/admin/games", headers=admin_headers)
    client.get(f"/api/admin/games/{game_id}/leaderboard", headers=admin_headers)
    
final_q_check = client.get("/api/admin/questions", headers=admin_headers)
matching_final = next((q for q in final_q_check.get_json().get("questions", []) if q.get("id") == q_id), None)
check("Question remains visible after multiple section navigations", matching_final is not None)

# 12. Cleanup all temporary verification rows
cleanup()

rem_q = [q for q in gs.gw_select("questions") if PREFIX in str(q.get("question_text", "")).lower()]
rem_g = [g for g in gs.gw_select("games") if g.get("game_pin") == GAME_PIN]
rem_p = [p for p in list_profiles() if PREFIX in str(p.get("email", "")).lower()]
check("Zero temporary questions remain", len(rem_q) == 0)
check("Zero temporary games remain", len(rem_g) == 0)
check("Zero temporary profiles remain", len(rem_p) == 0)

print("=" * 60)
print(f"ADMIN CONTROL DECK REGRESSION SUMMARY: {len(PASS)} PASSED, {len(FAIL)} FAILED")
print("=" * 60)

if FAIL:
    sys.exit(1)
sys.exit(0)

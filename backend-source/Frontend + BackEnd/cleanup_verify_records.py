"""Delete ONLY verification records from the real Supabase DB.

Targets (exact-match only):
- profiles: email LIKE 'verify-%@example.com'
- games: game_pin LIKE 'VERIFY%'
- questions: question_text LIKE 'VERIFY-%'
- all child rows referencing those game/user ids
- admin_actions: admin_user_id of verify profiles

Refuses to touch: admin@marketmaster.com, hardik@marketmaster.com,
non-VERIFY questions/games, and anything else.
"""

import os
import sys

sys.path.insert(0, "backend-source/Frontend + BackEnd")

from dotenv import load_dotenv  # noqa: E402

load_dotenv("backend-source/Frontend + BackEnd/.env")

from supabase import create_client  # noqa: E402

sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

SAFE_EMAILS = ("admin@marketmaster.com", "hardik@marketmaster.com")


def show(label, rows, key="id"):
    print("%s: %d" % (label, len(rows)))
    for r in rows[:20]:
        print("   - %s" % str(r.get(key, r.get("id"))))


vprofiles = (sb.table("profiles").select("id,email").like("email", "verify-%@example.com").execute().data or [])
for p in vprofiles:
    assert p["email"] not in SAFE_EMAILS, "SAFETY TRIP: %s" % p["email"]
show("verify profiles", vprofiles, "email")
vuids = [p["id"] for p in vprofiles]

vgames = (sb.table("games").select("id,game_pin").like("game_pin", "VERIFY%").execute().data or [])
show("verify games", vgames, "game_pin")
vgids = [g["id"] for g in vgames]

vquestions = (sb.table("questions").select("id,question_text").like("question_text", "VERIFY-%").execute().data or [])
show("verify questions", vquestions, "question_text")
vqids = [q["id"] for q in vquestions]

total = 0
for gid in vgids:
    for t in ("transactions", "answers", "positions", "leaderboard_snapshots"):
        rows = sb.table(t).select("id").eq("game_id", gid).execute().data or []
        for r in rows:
            sb.table(t).delete().eq("id", r["id"]).execute()
            total += 1
    for r in (sb.table("rounds").select("id").eq("game_id", gid).execute().data or []):
        sb.table("rounds").delete().eq("id", r["id"]).execute()
        total += 1
    for r in (sb.table("game_players").select("id").eq("game_id", gid).execute().data or []):
        sb.table("game_players").delete().eq("id", r["id"]).execute()
        total += 1
    for r in (sb.table("game_questions").select("id").eq("game_id", gid).execute().data or []):
        sb.table("game_questions").delete().eq("id", r["id"]).execute()
        total += 1
    sb.table("games").delete().eq("id", gid).execute()
    total += 1

for uid in vuids:
    for r in (sb.table("admin_actions").select("id").eq("admin_user_id", uid).execute().data or []):
        sb.table("admin_actions").delete().eq("id", r["id"]).execute()
        total += 1

for qid in vqids:
    # only if no longer referenced
    refs = (sb.table("game_questions").select("id").eq("question_id", qid).limit(1).execute().data or [])
    if not refs:
        sb.table("questions").delete().eq("id", qid).execute()
        total += 1

for uid in vuids:
    # game_players/answers/etc cascade from profiles; delete leftovers explicitly first
    for t in ("game_players", "answers", "positions", "transactions", "leaderboard_snapshots"):
        for r in (sb.table(t).select("id").eq("user_id", uid).execute().data or []):
            sb.table(t).delete().eq("id", r["id"]).execute()
            total += 1
    sb.table("profiles").delete().eq("id", uid).execute()
    total += 1

print("deleted rows total: %d" % total)

# confirm zero verify rows remain
left = 0
left += len(sb.table("profiles").select("id").like("email", "verify-%@example.com").execute().data or [])
left += len(sb.table("games").select("id").like("game_pin", "VERIFY%").execute().data or [])
left += len(sb.table("questions").select("id").like("question_text", "VERIFY-%").execute().data or [])
print("verify rows remaining: %d" % left)
sys.exit(0 if left == 0 else 1)

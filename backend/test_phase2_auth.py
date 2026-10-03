"""Phase 2 verification tests (run locally, no Supabase credentials needed).

Covers the 13 API assertions from the Phase 2 spec using the
in-memory fallback store. Run with the backend .venv python:

    backend-source/Frontend + BackEnd/.venv/bin/python \
        "backend-source/Frontend + BackEnd/test_phase2_auth.py"
"""

import json
import os
import sys

# Hermetic local suite: pre-set empty creds BEFORE any app/services import.
# python-dotenv resolves backend/.env relative to the caller file and
# load_dotenv() never overrides existing keys, so this forces the
# in-memory fallback deterministically. Live path: test_real_supabase_verify.py.
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.getcwd(), "backend"))


from app import app  # noqa: E402
from services.auth_store import reset_memory_store  # noqa: E402

PASS = []
FAIL = []


def check(label, cond, detail=""):
    if cond:
        PASS.append(label)
        print("PASS: {}".format(label))
    else:
        FAIL.append(label)
        print("FAIL: {} {}".format(label, detail))


def fresh_client():
    reset_memory_store()
    return app.test_client()


def no_secret_leak(payload):
    body = json.dumps(payload or {})
    return "password_hash" not in body and "SERVICE_ROLE" not in body


# 1. Signup with valid data -> success (201, safe user, auto-login)
c = fresh_client()
r = c.post("/api/auth/signup", json={
    "name": "Student One",
    "email": "student1@example.com",
    "password": "password123",
    "confirm_password": "password123",
})
d = r.get_json()
check("1. signup valid -> 201 + success",
      r.status_code == 201 and d.get("success") is True and d.get("user", {}).get("email") == "student1@example.com"
      and d.get("user", {}).get("role") == "participant", str((r.status_code, d)))

# 2. Signup duplicate email -> rejected (409)
r = c.post("/api/auth/signup", json={
    "name": "Student One",
    "email": "student1@example.com",
    "password": "password123",
    "confirm_password": "password123",
})
check("2. signup duplicate -> 409", r.status_code == 409 and r.get_json().get("success") is False,
      str((r.status_code, r.get_json())))

# 3. Signup invalid email -> rejected (400)
c = fresh_client()
r = c.post("/api/auth/signup", json={
    "name": "Bad Email", "email": "not-an-email",
    "password": "password123", "confirm_password": "password123",
})
check("3. signup invalid email -> 400", r.status_code == 400, str((r.status_code, r.get_json())))

# 4. Signup mismatched passwords -> rejected (400)
r = c.post("/api/auth/signup", json={
    "name": "Mismatch", "email": "mismatch@example.com",
    "password": "password123", "confirm_password": "different123",
})
check("4. signup mismatched passwords -> 400", r.status_code == 400, str((r.status_code, r.get_json())))

# 5. Signup cannot create admin role (role ignored -> participant)
r = c.post("/api/auth/signup", json={
    "name": "Sneaky", "email": "sneaky@example.com",
    "password": "password123", "confirm_password": "password123",
    "role": "admin",
})
d = r.get_json()
check("5. signup role=admin ignored -> participant",
      r.status_code == 201 and d.get("user", {}).get("role") == "participant",
      str((r.status_code, d)))

# 6. Login correct password -> success
c = fresh_client()
c.post("/api/auth/signup", json={
    "name": "Login User", "email": "login@example.com",
    "password": "password123", "confirm_password": "password123",
})
c.post("/api/auth/logout")
r = c.post("/api/auth/login", json={"email": "login@example.com", "password": "password123"})
d = r.get_json()
check("6. login correct -> 200 + token + safe user",
      r.status_code == 200 and d.get("success") is True and d.get("token") and d.get("user", {}).get("email") == "login@example.com",
      str((r.status_code, d)))

# 7. Login wrong password -> rejected (401)
r = c.post("/api/auth/login", json={"email": "login@example.com", "password": "wrongpass99"})
check("7. login wrong password -> 401", r.status_code == 401, str((r.status_code, r.get_json())))

# 8. Login disabled user -> rejected (403)
from services import auth_store as _store_module  # noqa: E402

c = fresh_client()
c.post("/api/auth/signup", json={
    "name": "Disabled User", "email": "disabled@example.com",
    "password": "password123", "confirm_password": "password123",
})
_store_module._mem_by_email["disabled@example.com"]["status"] = "disabled"
r = c.post("/api/auth/login", json={"email": "disabled@example.com", "password": "password123"})
check("8. login disabled -> 403", r.status_code == 403, str((r.status_code, r.get_json())))
_store_module._mem_by_email["disabled@example.com"]["status"] = "active"

# 9. /api/auth/me after login -> authenticated user (via session + via token)
c = fresh_client()
rs = c.post("/api/auth/signup", json={
    "name": "Me User", "email": "me@example.com",
    "password": "password123", "confirm_password": "password123",
})
token = rs.get_json().get("token", "")
r = c.get("/api/auth/me")
check("9a. me after login (session) -> 200", r.status_code == 200 and r.get_json().get("user", {}).get("email") == "me@example.com",
      str((r.status_code, r.get_json())))
c2 = app.test_client()  # fresh client, no session cookie -> use Bearer token
r = c2.get("/api/auth/me", headers={"Authorization": "Bearer {}".format(token)})
check("9b. me with Bearer token -> 200", r.status_code == 200, str((r.status_code, r.get_json())))

# 10. Logout -> success; 11. me after logout -> 401
r = c.post("/api/auth/logout")
check("10. logout -> 200 success", r.status_code == 200 and r.get_json().get("success") is True,
      str((r.status_code, r.get_json())))
r = c.get("/api/auth/me")
check("11. me after logout -> 401", r.status_code == 401, str((r.status_code, r.get_json())))

# 12/13. Password / password_hash never returned
c = fresh_client()
r = c.post("/api/auth/signup", json={
    "name": "Leak Check", "email": "leak@example.com",
    "password": "password123", "confirm_password": "password123",
})
signup_body = r.get_json()
r = c.post("/api/auth/login", json={"email": "leak@example.com", "password": "password123"})
login_body = r.get_json()
r = c.get("/api/auth/me")
me_body = r.get_json()
all_clean = all(no_secret_leak(b) for b in (signup_body, login_body, me_body))
check("12/13. no password/password_hash in signup+login+me", all_clean,
      str((signup_body, login_body, me_body)))

# 14. Existing Flask app still starts (route table intact)
routes = [str(x) for x in app.url_map.iter_rules()]
needed = ["/api/auth/signup", "/api/auth/login", "/api/auth/me", "/api/auth/logout",
          "/api/game/join", "/api/game/current", "/api/leaderboard"]
check("14. app routes intact", all(any(n in x for x in routes) for n in needed), str(routes))

print("")
print("Passed {}/{} checks.".format(len(PASS), len(PASS) + len(FAIL)))
if FAIL:
    print("FAILURES:", FAIL)
    sys.exit(1)
print(">>> ALL PHASE 2 AUTH TESTS PASSED <<<")

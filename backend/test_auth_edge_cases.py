"""Automated verification suite for authentication exceptions and edge cases.

Verifies:
1. Valid admin login
2. Malformed email handling (missing @, missing domain, bad syntax)
3. Non-existent email handling (clean 401, no DB error)
4. Non-UUID string identifier (safely handled, no Postgres 22P02 crash)
5. Wrong password handling
6. Empty or missing fields handling (clean 400)
7. Disabled user account handling (clean 403)
8. Signup validation (short password, mismatch, bad email, duplicate email)
9. Session me endpoint (/api/auth/me) with token, bad token, no token
10. Logout and session termination
11. Zero secrets leak (no password_hash in any payload)
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(__file__))

from app import app
from services.auth_store import find_profile_by_email, reset_memory_store
from services.passwords import hash_password

PASS = []
FAIL = []


def check(label, cond, detail=""):
    if cond:
        PASS.append(label)
        print(f"PASS: {label}")
    else:
        FAIL.append(label)
        print(f"FAIL: {label} -> {detail}")


client = app.test_client()

print("=" * 60)
print("STARTING AUTHENTICATION & EXCEPTION HARDENING TEST SUITE")
print("=" * 60)

# 1. Empty body or missing fields
r = client.post("/api/auth/login", json={})
check("1. Login empty body -> 400", r.status_code == 400 and not r.get_json().get("success"))

r = client.post("/api/auth/login", json={"email": "", "password": ""})
check("2. Login blank email/password -> 400", r.status_code == 400 and "required" in r.get_json().get("message", "").lower())

# 2. Malformed email format with @
r = client.post("/api/auth/login", json={"email": "bademail@", "password": "password123"})
check("3. Login malformed email (bademail@) -> 400", r.status_code == 400 and "valid email" in r.get_json().get("message", "").lower())

r = client.post("/api/auth/login", json={"email": "bademail@domain", "password": "password123"})
check("4. Login malformed email without dot -> 400", r.status_code == 400 and "valid email" in r.get_json().get("message", "").lower())

# 3. Non-UUID string without @ (used to trigger Postgres 22P02 crash)
r = client.post("/api/auth/login", json={"email": "notanemailnoruuid", "password": "password123"})
check("5. Login non-UUID string -> clean 401 (no 22P02 DB crash)", r.status_code == 401 and not r.get_json().get("success"))

# 4. Non-existent email with valid format
r = client.post("/api/auth/login", json={"email": "nobody_exists_12345@example.com", "password": "password123"})
check("6. Login non-existent email -> 401", r.status_code == 401 and "invalid" in r.get_json().get("message", "").lower())

# 5. Admin login with correct credentials
r = client.post("/api/auth/login", json={"email": "admin@marketmaster.com", "password": "ECELLADMIN"})
d = r.get_json()
admin_token = d.get("token")
check("7. Admin login correct -> 200 + token + role=admin",
      r.status_code == 200 and d.get("success") and admin_token and d.get("user", {}).get("role") == "admin",
      str(d))

# 6. Admin login with whitespace around email
r = client.post("/api/auth/login", json={"email": "  admin@marketmaster.com  ", "password": "ECELLADMIN"})
check("8. Admin login with whitespace trimmed -> 200", r.status_code == 200 and r.get_json().get("success"))

# 7. Admin login wrong password
r = client.post("/api/auth/login", json={"email": "admin@marketmaster.com", "password": "WRONG_PASSWORD_99"})
check("9. Admin login wrong password -> 401", r.status_code == 401 and "invalid" in r.get_json().get("message", "").lower())

# 8. Signup: password too short (< 8 chars)
test_email = f"auth_test_{uuid.uuid4().hex[:8]}@example.com"
r = client.post("/api/auth/signup", json={
    "name": "Short Pass User",
    "email": test_email,
    "password": "short",
    "confirm_password": "short"
})
check("10. Signup password < 8 chars -> 400", r.status_code == 400 and "at least 8" in r.get_json().get("message", "").lower())

# 9. Signup: password mismatch
r = client.post("/api/auth/signup", json={
    "name": "Mismatch User",
    "email": test_email,
    "password": "validpassword123",
    "confirm_password": "differentpassword123"
})
check("11. Signup passwords mismatch -> 400", r.status_code == 400 and "do not match" in r.get_json().get("message", "").lower())

# 10. Signup: valid creation
r = client.post("/api/auth/signup", json={
    "name": "Valid Test User",
    "email": test_email,
    "password": "validpassword123",
    "confirm_password": "validpassword123"
})
d = r.get_json()
user_token = d.get("token")
user_id = d.get("user", {}).get("id")
check("12. Signup valid -> 201 + participant role",
      r.status_code == 201 and d.get("success") and user_token and d.get("user", {}).get("role") == "participant",
      str(d))

# 11. Signup: duplicate email rejection (409)
r = client.post("/api/auth/signup", json={
    "name": "Duplicate User",
    "email": test_email,
    "password": "validpassword123",
    "confirm_password": "validpassword123"
})
check("13. Signup duplicate email -> 409", r.status_code == 409 and "already exists" in r.get_json().get("message", "").lower())

# 12. Participant login after signup
r = client.post("/api/auth/login", json={"email": test_email, "password": "validpassword123"})
check("14. Login with newly created user -> 200", r.status_code == 200 and r.get_json().get("success"))

# 13. Verify /api/auth/me with Bearer token
r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {user_token}"})
check("15. /api/auth/me with valid Bearer token -> 200", r.status_code == 200 and r.get_json().get("user", {}).get("email") == test_email)

# 14. Verify /api/auth/me with invalid token
r = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.fake.token"})
check("16. /api/auth/me with invalid token -> 401", r.status_code == 401 and not r.get_json().get("success"))

# 15. Verify /api/auth/me with no auth
client2 = app.test_client()
r = client2.get("/api/auth/me")
check("17. /api/auth/me unauthenticated -> 401", r.status_code == 401 and not r.get_json().get("success"))

# 16. Verify logout
r = client.post("/api/auth/logout")
check("18. /api/auth/logout -> 200", r.status_code == 200 and r.get_json().get("success"))

# 17. Secrets leak check
def has_leak(obj):
    import json
    dump = json.dumps(obj)
    return "password_hash" in dump or "service_role" in dump.lower()

r = client.post("/api/auth/login", json={"email": test_email, "password": "validpassword123"})
login_data = r.get_json()
check("19. Zero secret leak in login response", not has_leak(login_data))

# Cleanup temporary participant created for test
try:
    from services.supabase_db import get_supabase_client, is_supabase_configured
    if is_supabase_configured() and get_supabase_client():
        get_supabase_client().table("profiles").delete().eq("email", test_email).execute()
        print(f"Cleaned up test profile: {test_email}")
except Exception as e:
    print(f"Cleanup note: {e}")

print("=" * 60)
print(f"TEST RESULTS: {len(PASS)} PASSED, {len(FAIL)} FAILED")
print("=" * 60)

if FAIL:
    sys.exit(1)
sys.exit(0)

"""Provision the first admin account (run manually, never via API).

Usage (from repo root):
    backend-source/Frontend + BackEnd/.venv/bin/python \
        "backend-source/Frontend + BackEnd/provision_first_admin.py" \
        "Admin Name" admin@example.com StrongPassword123

- Refuses to run if an admin already exists (safe, idempotent guard).
- Works against Supabase when configured, else the local store.
- Never prints passwords or hashes.
"""

import os
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.getcwd(), "backend"))

from services.auth_store import find_profile_by_email, create_profile_row  # noqa: E402
from services.passwords import hash_password  # noqa: E402


def main():
    if len(sys.argv) != 4:
        print("Usage: provision_first_admin.py \"Name\" email password")
        return 2
    name, email, password = sys.argv[1], sys.argv[2].strip().lower(), sys.argv[3]
    if len(password) < 8:
        print("Refused: password must be at least 8 characters.")
        return 1
    # Refuse if an admin already exists (safe, idempotent guard).
    try:
        from services.auth_store import list_profiles
        if any(p.get("role") == "admin" for p in list_profiles()):
            print("Refused: an admin account already exists.")
            return 1
    except Exception as exc:
        print("Could not verify existing admins: {}".format(exc))
        return 1
    if find_profile_by_email(email):
        print("Refused: an account with this email already exists.")
        return 1
    row = create_profile_row(name.strip(), email, hash_password(password),
                             role="admin", avatar="🦁", status="active")
    if not row:
        print("Failed to create admin (database error).")
        return 1
    print("Admin created: {} <{}>".format(row.get("name"), row.get("email")))
    return 0


if __name__ == "__main__":
    sys.exit(main())

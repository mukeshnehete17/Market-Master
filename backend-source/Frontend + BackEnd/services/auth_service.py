"""Auth business logic (Phase 2).

Validates signup/login input server-side and talks to the profiles
store (Supabase when configured, in-memory fallback otherwise).

- Signup always creates role='participant', status='active'.
- Any client-supplied 'role' is ignored.
- Never returns password_hash; never logs passwords.
"""

import re

from services.auth_store import (
    create_profile_row,
    find_profile_by_email,
    find_profile_by_id,
)
from services.passwords import hash_password, verify_password

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MIN_PASSWORD_LEN = 8


def safe_user(row):
    """Project a profile row to the public, secret-free shape."""
    if not row:
        return None
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "email": row.get("email"),
        "role": row.get("role", "participant"),
        "avatar": row.get("avatar", "🦊"),
    }


def _validate_signup(name, email, password, confirm_password):
    name = str(name or "").strip()
    email = str(email or "").strip().lower()
    password = str(password or "")
    confirm_password = str(confirm_password or "")

    if not name:
        return "Full name is required."
    if len(name) > 100:
        return "Name must be 100 characters or fewer."
    if not email:
        return "Email is required."
    if len(email) > 254 or not EMAIL_RE.match(email):
        return "Enter a valid email address."
    if not password:
        return "Password is required."
    if len(password) < MIN_PASSWORD_LEN:
        return "Password must be at least 8 characters."
    if password != confirm_password:
        return "Passwords do not match."
    return None


def signup(name, email, password, confirm_password):
    """Create a participant account. Returns (user, error)."""
    err = _validate_signup(name, email, password, confirm_password)
    if err:
        return None, err

    email = str(email).strip().lower()
    name = str(name).strip()

    if find_profile_by_email(email):
        return None, "An account with this email already exists."

    row = create_profile_row(
        name=name,
        email=email,
        password_hash=hash_password(password),
        role="participant",
        avatar="🦊",
        status="active",
    )
    if not row:
        return None, "Could not create account. Please try again."
    return safe_user(row), None


def login(identifier, password):
    """Authenticate by email (preferred) or legacy user_id.

    Returns (user, error, status_code).
    """
    identifier = str(identifier or "").strip()
    password = str(password or "")

    if not identifier or not password:
        return None, "Email and password are required.", 400

    row = None
    if "@" in identifier:
        row = find_profile_by_email(identifier)
    else:
        # Legacy login form used user_id (e.g. 'hardik'); try id lookup,
        # then email local-part match, then legacy demo_users fallback.
        row = find_profile_by_id(identifier)
        if row is None:
            email_guess = "{}@marketmaster.com".format(identifier.lower())
            row = find_profile_by_email(email_guess)
        if row is None:
            row = _legacy_demo_login(identifier, password)
            if row is not None:
                return row, None, 200
            return None, "Invalid email or password.", 401

    if row is None:
        return None, "Invalid email or password.", 401

    if not verify_password(row.get("password_hash", ""), password):
        return None, "Invalid email or password.", 401

    status = (row.get("status") or "active").lower()
    if status == "banned":
        return None, "This account has been banned.", 403
    if status == "disabled":
        return None, "This account has been disabled.", 403
    if status != "active":
        return None, "This account is not active.", 403

    return safe_user(row), None, 200


def _legacy_demo_login(user_id, password):
    """Fallback for pre-Phase-2 demo ids when Supabase is unavailable.

    Kept so existing local sessions keep working until demo cleanup.
    Returns a safe user or None. Never exposes hashes.
    """
    try:
        from database.get_user import get_user_by_id
        from werkzeug.security import check_password_hash
    except Exception:
        return None
    try:
        user = get_user_by_id(user_id)
    except Exception:
        return None
    if not user:
        return None
    try:
        if not check_password_hash(user.get("password_hash", ""), password):
            return None
    except Exception:
        return None
    email = "{}@marketmaster.com".format(str(user.get("id", "")).lower())
    existing = find_profile_by_email(email)
    if existing:
        return safe_user(existing)
    return {
        "id": str(user.get("id", "")),
        "name": user.get("name", ""),
        "email": email,
        "role": user.get("role", "participant"),
        "avatar": "🦊",
    }

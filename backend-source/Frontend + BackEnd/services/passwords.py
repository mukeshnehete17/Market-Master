"""Password hashing helpers (Phase 2).

Uses Werkzeug's pbkdf2:sha256 hasher, matching the format of the
password_hash seeds in supabase/migrations/001_initial_schema.sql.
Werkzeug is already part of the Flask environment (no new dependency).
"""

from werkzeug.security import check_password_hash as _check, generate_password_hash as _generate


def hash_password(password):
    """Hash a plaintext password. Never store or log the input."""
    return _generate(str(password), method="pbkdf2:sha256")


def verify_password(password_hash, password):
    """Verify a plaintext password against a stored hash. Never raises."""
    try:
        if not password_hash or password is None:
            return False
        return _check(password_hash, str(password))
    except Exception:
        return False

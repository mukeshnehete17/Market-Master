"""Profiles storage layer (Phase 2).

Source of truth is the Supabase `profiles` table when credentials are
configured; otherwise an in-memory store (seeded with demo profiles)
keeps local development and tests working without credentials.

Security:
- Never logs passwords or hashes.
- Service-role key stays server-side inside services/supabase_db.py.
- All email lookups are case-insensitive (normalized to lowercase).
"""

import uuid

from services.passwords import hash_password
from services.supabase_db import get_supabase_client, is_supabase_configured
from services.db_errors import DatabaseUnavailable


def _fail(action, exc):
    raise DatabaseUnavailable("Supabase %s on 'profiles' failed: %s" % (action, exc))

# In-memory fallback for local dev / tests (no Supabase credentials).
_mem_by_email = {}
_mem_by_id = {}
_mem_seeded = False

# Administrator profile mirroring the migration seed (required for Admin Panel access).
# Password: ECELLADMIN
# NOTE: local fallback intentionally seeds admin only. Production starts
# empty; participants sign up and all content is admin-created.
_FALLBACK_SEEDS = (
    {
        "id": "a0000000-0000-0000-0000-000000000001",
        "name": "Admin",
        "email": "admin@marketmaster.com",
        "password": "ECELLADMIN",
        "role": "admin",
        "avatar": "🦁",
        "status": "active",
    },
)



def _norm_email(email):
    return str(email or "").strip().lower()


def _use_supabase():
    return is_supabase_configured() and get_supabase_client() is not None


def _seed_memory_store():
    global _mem_seeded
    if _mem_seeded:
        return
    for seed in _FALLBACK_SEEDS:
        row = {
            "id": seed["id"],
            "name": seed["name"],
            "email": _norm_email(seed["email"]),
            "password_hash": hash_password(seed["password"]),
            "role": seed["role"],
            "avatar": seed["avatar"],
            "status": seed["status"],
        }
        _mem_by_email[row["email"]] = row
        _mem_by_id[row["id"]] = row
    _mem_seeded = True


def reset_memory_store():
    """Clear the in-memory fallback (used by tests). Re-seeds demos."""
    global _mem_by_email, _mem_by_id, _mem_seeded
    _mem_by_email = {}
    _mem_by_id = {}
    _mem_seeded = False
    _seed_memory_store()


def _to_row(data):
    """Normalize a Supabase profiles row to the internal dict shape."""
    if not isinstance(data, dict):
        return None
    return {
        "id": str(data.get("id", "")),
        "name": data.get("name", ""),
        "email": _norm_email(data.get("email", "")),
        "password_hash": data.get("password_hash", ""),
        "role": data.get("role", "participant"),
        "avatar": data.get("avatar", "🦊"),
        "status": data.get("status", "active"),
    }


def find_profile_by_email(email):
    """Find a profile by email (case-insensitive). Returns row or None."""
    email = _norm_email(email)
    if not email:
        return None
    if _use_supabase():
        try:
            client = get_supabase_client()
            resp = client.table("profiles").select("*").eq("email", email).limit(1).execute()
            rows = getattr(resp, "data", None) or []
            if rows:
                return _to_row(rows[0])
            return None
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("select", e)
    _seed_memory_store()
    return _mem_by_email.get(email)


def find_profile_by_id(user_id):
    """Find a profile by id. Returns row or None."""
    user_id = str(user_id or "").strip()
    if not user_id:
        return None
    # Validate UUID before querying Supabase Postgres (id column is type UUID).
    # Non-UUID queries would cause Postgres error 22P02 (invalid input syntax for type uuid).
    is_uuid = False
    try:
        uuid.UUID(user_id)
        is_uuid = True
    except (ValueError, AttributeError, TypeError):
        is_uuid = False

    if _use_supabase():
        if not is_uuid:
            _seed_memory_store()
            return _mem_by_id.get(user_id)
        try:
            client = get_supabase_client()
            resp = client.table("profiles").select("*").eq("id", user_id).limit(1).execute()
            rows = getattr(resp, "data", None) or []
            if rows:
                return _to_row(rows[0])
            return None
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("select", e)
    _seed_memory_store()
    return _mem_by_id.get(user_id)


def create_profile_row(name, email, password_hash, role="participant", avatar="🦊", status="active"):
    """Insert a profile row. Returns the created row or None on failure."""
    email = _norm_email(email)
    profile_id = str(uuid.uuid4())
    if _use_supabase():
        try:
            client = get_supabase_client()
            payload = {
                "id": profile_id,
                "name": name,
                "email": email,
                "password_hash": password_hash,
                "role": role if role in ("participant", "admin") else "participant",
                "avatar": avatar or "🦊",
                "status": status or "active",
            }
            resp = client.table("profiles").insert(payload).execute()
            rows = getattr(resp, "data", None) or []
            if rows:
                return _to_row(rows[0])
            return _to_row(payload)
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("insert", e)
    _seed_memory_store()
    if email in _mem_by_email:
        return None
    row = {
        "id": profile_id,
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": role if role in ("participant", "admin") else "participant",
        "avatar": avatar or "🦊",
        "status": status or "active",
    }
    _mem_by_email[email] = row
    _mem_by_id[profile_id] = row
    return row


def list_profiles():
    """Return all profiles (admin use). Never includes password hashes."""
    if _use_supabase():
        try:
            client = get_supabase_client()
            resp = client.table("profiles").select(
                "id,name,email,role,avatar,status,created_at,updated_at").execute()
            return list(getattr(resp, "data", None) or [])
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("select", e)
    _seed_memory_store()
    return [{"id": r["id"], "name": r["name"], "email": r["email"],
             "role": r["role"], "avatar": r["avatar"], "status": r["status"]}
            for r in _mem_by_email.values()]



def update_profile_row(user_id, patch):
    """Update allowed profile fields. Returns updated row or None."""
    allowed = {k: v for k, v in (patch or {}).items()
               if k in ("name", "role", "avatar", "status", "password_hash")}
    if "role" in allowed and allowed["role"] not in ("participant", "admin"):
        return None
    if "status" in allowed and allowed["status"] not in ("active", "disabled", "banned"):
        return None
    if not allowed:
        return None
    user_id_str = str(user_id or "").strip()
    if _use_supabase():
        try:
            uuid.UUID(user_id_str)
        except (ValueError, AttributeError, TypeError):
            return None
        try:
            client = get_supabase_client()
            (client.table("profiles").update(dict(allowed))
             .eq("id", user_id_str).execute())
            return find_profile_by_id(user_id_str)
        except DatabaseUnavailable:
            raise
        except Exception as e:
            _fail("update", e)
    _seed_memory_store()
    row = _mem_by_id.get(user_id_str)
    if not row:
        return None
    row.update(allowed)
    return dict(row)

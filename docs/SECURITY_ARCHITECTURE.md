# Market Master — Security Architecture

## 1. Threat Model & Mitigation Matrix

| Threat Category | Potential Attack Vector | Architectural Mitigation | Verification Standard |
| :--- | :--- | :--- | :--- |
| **Answer Inspection** | Student inspects network traffic or React state to find the correct answer before submitting. | The backend question sanitizer function strictly strips `correct_option` and `explanation` from `/api/game/current` payloads. Solution fields are only included after `answer_revealed_at`. | Verified by automated test: zero occurrences of `correct_option` in player payloads. |
| **Direct Database Breach** | Attacker attempts to query Supabase directly using anon key. | All 12 tables have Row Level Security (RLS) enabled in deny-by-default mode (`002_rls_lockdown.sql`). No permissive anon policies exist. Only the backend (via service-role) can query data. | Direct anon PostgREST queries return HTTP 403 Forbidden. |
| **Credential & Secret Exposure** | `SUPABASE_SERVICE_ROLE_KEY` or `SECRET_KEY` leaked to frontend bundle. | Service keys are read exclusively in Python (`os.environ`). Vite configuration excludes backend environment variables from client bundles. | Audited via production bundle build inspection. |
| **Insecure Direct Object Reference (IDOR)** | Student tries to settle another player's position or view other students' unrevealed submissions. | All student routes resolve identity strictly from authenticated token/session (`engine.current_identity()`). Submissions and profile fetches ignore client-provided user IDs. | Identity is resolved server-side; arbitrary `user_id` query parameters are ignored. |
| **Double Spending / Race Conditions** | Student rapidly clicks "Confirm Position" multiple times to place duplicate bids. | Composite unique constraints on `answers(round_id, user_id)` and `positions(round_id, user_id)`. The second attempt raises HTTP 409 Conflict. | Verified by concurrent submission automated test with 140 threads. |
| **Role Escalation** | Student crafts HTTP requests to `/api/admin/*`. | All admin routes verify `user.role == 'admin'` through `@admin_required` decorators or service checks. Non-admin users receive immediate HTTP 403 Forbidden. | Verified in role-access automated test suite. |
| **Brute Force & Injection** | Password cracking or SQL injection attempts. | Passwords hashed using PBKDF2/bcrypt. All Supabase queries use parameterized PostgREST calls with zero raw string concatenation. | Sanitized inputs across all authentication routes. |

---

## 2. Environment Secrets Isolation

```
[Browser / Client]
  ├── Can Access: VITE_API_BASE_URL (public routing config)
  └── MUST NEVER ACCESS:
        ❌ SUPABASE_SERVICE_ROLE_KEY
        ❌ SECRET_KEY
        ❌ DATABASE_URL / DB PASSWORDS

[Flask Backend (Private Runtime)]
  ├── Reads: SUPABASE_URL
  ├── Reads: SUPABASE_SERVICE_ROLE_KEY
  ├── Reads: SECRET_KEY
  └── Enforces: Identity validation, session cookie encryption, role authorization
```

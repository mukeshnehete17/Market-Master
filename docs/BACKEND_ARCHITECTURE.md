# Market Master — Backend Architecture

## 1. Architectural Philosophy: Strict Layer Separation
The Flask backend strictly enforces four isolated architectural tiers:

```
[HTTP Request]
       ↓
1. ROUTE LAYER (Blueprints: /api/auth, /api/game, /api/admin, /api/health)
   - Parses request JSON and query parameters
   - Performs identity authentication & role authorization checks
   - Validates input format (UUID regex, number ranges)
   - Dispatches to Service Layer
       ↓
2. SERVICE LAYER (Business Logic)
   - game_engine.py: Game lifecycle, student join, answer submission, settlement
   - admin_service.py: Control deck orchestration, game & question CRUD, metrics
   - auth_service.py / auth_store.py: Password hashing, token generation, profile sync
   - questions_service.py: Question validation and repository management
       ↓
3. DATA ACCESS LAYER (Supabase Gateway)
   - supabase_db.py / game_store.py: Typed PostgREST queries using service-role client
   - Handles network timeouts, retries, and raises DatabaseUnavailable
       ↓
4. DATABASE (Supabase PostgreSQL)
```

**Golden Rule**: Route functions NEVER execute direct database queries or implement business calculations.

---

## 2. Directory Structure

```
backend/
├── app.py                      # Flask initialization, CORS, session config, error handlers
├── requirements.txt            # Minimal production dependencies
├── routes/
│   ├── auth.py                 # /api/auth/signup, login, me, logout
│   ├── api_game.py             # /api/game/join, current, submit, market, result, next
│   ├── admin.py                # /api/admin/* (deck, dashboard, questions, games, students)
│   └── health.py               # /api/health, /api/health/db
├── services/
│   ├── game_engine.py          # Authoritative live game simulation & settlement engine
│   ├── admin_service.py        # Admin control deck, metrics aggregation, moderation
│   ├── auth_service.py         # Authentication workflows and token issuance
│   ├── auth_store.py           # User profiles repository access
│   ├── questions_service.py    # Question repository workflows
│   ├── game_store.py           # High-speed data caching and gateway
│   ├── supabase_db.py          # Low-level Supabase client wrapper & query execution
│   └── passwords.py            # Password hashing & verification
└── tests/
    ├── test_admin_deck_regression.py
    └── test_full_production_hardening.py
```

---

## 3. Session & Authentication Architecture
- **Bearer Token + Cookie Dual Support**:
  - Web and mobile clients pass `Authorization: Bearer <token>` in the HTTP header.
  - Flask session cookie (`HttpOnly; SameSite=Lax`) is supported as a fallback for browser sessions.
- **Identity Resolution**:
  - `engine.current_identity()` resolves user identity first from Bearer token, then from Flask session.
  - Returns authenticated user dictionary `{"id": UUID, "name": str, "email": str, "role": str}`.
  - If invalid or expired, returns `None` immediately, causing routes to return 401 Unauthorized.

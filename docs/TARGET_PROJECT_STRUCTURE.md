# Market Master — Target Project Structure & Migration Plan

## 1. Analysis of Current Repository Layout Anomalies

### Critical Structural Flaws Discovered in Audit:
1. **Unclear Root & Bizarre Nested Paths**:
   - Backend is located inside `backend-source/Frontend + BackEnd/` (a path containing spaces and confusing names).
   - Frontend is located inside `frontend-ui/FrontEnd/apps/web/` (a monorepo artifact inside a wrapper folder).
2. **Duplicate/Obsolete Frontend Inside Backend**:
   - `backend-source/Frontend + BackEnd/frontend/` is an old, abandoned React prototype containing only `Login.jsx` and an empty `App.jsx`. It is not imported or served anywhere.
3. **Dead SSR Templates & Routes**:
   - `backend-source/Frontend + BackEnd/templates/` and `static/` contain legacy Jinja2 SSR files (`index.html`, `finished.html`, `join.html`, `market.html`) from the earliest prototype before the React SPA was built.
4. **Duplicate Virtual Environments**:
   - Both `.venv` and `venv` exist in `backend-source/Frontend + BackEnd/`.
5. **Obsolete Demo Data**:
   - `backend-source/Frontend + BackEnd/database/demo_*.py` contains static dummy files that have been superseded by Supabase.

---

## 2. Target Clean Production Layout

```
Market-Master/
├── .gitignore
├── README.md
├── vercel.json                 # Unified deployment ingress
├── docs/                       # Authoritative engineering documentation
│   ├── SYSTEM_BLUEPRINT.md
│   ├── PRODUCT_DEFINITION.md
│   ├── ACTORS_AND_PERMISSIONS.md
│   ├── MVP_FEATURE_SPECIFICATION.md
│   ├── USER_WORKFLOWS.md
│   ├── GAME_STATE_MACHINE.md
│   ├── DOMAIN_MODEL.md
│   ├── DATABASE_ARCHITECTURE.md
│   ├── BACKEND_ARCHITECTURE.md
│   ├── API_CONTRACT.md
│   ├── FRONTEND_BACKEND_CONTRACT.md
│   ├── FRONTEND_ARCHITECTURE.md
│   ├── SECURITY_ARCHITECTURE.md
│   ├── ERROR_HANDLING.md
│   ├── DEPLOYMENT_ARCHITECTURE.md
│   ├── TARGET_PROJECT_STRUCTURE.md
│   ├── ENVIRONMENT_CONFIGURATION.md
│   ├── OBSERVABILITY.md
│   ├── FAILURE_RECOVERY.md
│   ├── TEST_STRATEGY.md
│   ├── ACCEPTANCE_CRITERIA.md
│   └── architecture-decisions/
│       ├── ADR-001-project-structure.md
│       ├── ADR-002-authentication.md
│       ├── ADR-003-database.md
│       ├── ADR-004-game-state-machine.md
│       ├── ADR-005-api-contract.md
│       ├── ADR-006-realtime.md
│       ├── ADR-007-deployment.md
│       └── ADR-008-security.md
├── supabase/                   # Database migrations & RLS definitions
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_rls_lockdown.sql
├── backend/                    # Clean Flask API service
│   ├── app.py
│   ├── requirements.txt
│   ├── routes/
│   │   ├── auth.py
│   │   ├── api_game.py
│   │   ├── admin.py
│   │   └── health.py
│   ├── services/
│   │   ├── game_engine.py
│   │   ├── admin_service.py
│   │   ├── auth_service.py
│   │   ├── auth_store.py
│   │   ├── questions_service.py
│   │   ├── game_store.py
│   │   ├── supabase_db.py
│   │   └── passwords.py
│   └── tests/
│       ├── test_admin_deck_regression.py
│       └── test_full_production_hardening.py
└── frontend/                   # Clean React 19 + Vite TypeScript SPA
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles.css
        ├── api/
        ├── components/
        ├── hooks/
        └── types/
```

---

## 3. Safe Migration Strategy (Stage B Execution)
1. **Dependency Analysis**: Verify that moving `backend-source/Frontend + BackEnd` to `backend/` and `frontend-ui/FrontEnd/apps/web` to `frontend/` updates only:
   - `vercel.json` paths
   - Test script CWD paths
   - Git tracking
2. **Zero In-Flight Changes**: All files will be copied/moved cleanly using git operations so history is preserved.
3. **Dead Code Elimination**: Safely retire the unused `backend-source/.../frontend` dummy folder, legacy `templates/`, and dead prototype scripts after verifying zero imports.

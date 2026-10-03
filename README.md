# Market Master — Institutional Financial Quiz & Trading Simulation Platform

Market Master is a real-time, synchronized multiplayer financial quiz competition platform. Participants act as market traders, evaluating financial market intelligence questions and allocating risk against virtual capital under live market dynamics.

---

## Architecture Overview

```
                      [Browser / Mobile Clients]
                                  │
                                  │ HTTPS Traffic
                                  ▼
                         [Vercel Edge Ingress]
                                  │
         ┌────────────────────────┴────────────────────────┐
         │                                                 │
   /api/(.*)                                             /(.*)
         ▼                                                 ▼
[Flask REST API Service]                        [React 19 + TypeScript SPA]
         │
         │ PostgREST (TLS 1.3)
         ▼
[Supabase Managed PostgreSQL]
 (Single Source of Truth, RLS deny-by-default)
```

---

## Directory Structure

```
Market-Master/
├── .gitignore
├── README.md
├── vercel.json                 # Production edge routing & ingress
├── docs/                       # Complete engineering specifications & ADRs
│   ├── SYSTEM_BLUEPRINT.md     # Authoritative Master Architecture Blueprint
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
│   └── architecture-decisions/ (ADR-001 through ADR-008)
├── supabase/                   # Database migrations & RLS lockdown
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_rls_lockdown.sql
├── backend/                    # Python Flask API Service
│   ├── app.py                  # Server entrypoint & routing
│   ├── requirements.txt        # Backend dependencies
│   ├── routes/                 # REST API endpoints (/api/auth, /api/game, /api/admin, /api/health)
│   ├── services/               # Game engine, settlement calculations, admin service
│   ├── database/               # Data access layer
│   └── tests/                  # Automated test suites
└── frontend/                   # React 19 + Vite TypeScript Web App
    ├── apps/web/               # Web client workspace
    │   ├── src/
    │   │   ├── components/     # GameArena, JoinGame, Login, Leaderboard, AdminPanel
    │   │   ├── api/            # Typed client API services
    │   │   └── styles.css      # Universal styling & dark terminal theme
    │   └── package.json
    └── package.json
```

---

## Quickstart

### 1. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env # Supply SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
python3 app.py
```
Backend runs locally at `http://127.0.0.1:5000`.

### 2. Frontend Setup
```bash
cd frontend/apps/web
npm install # or pnpm install
npm run dev
```
Frontend runs locally at `http://127.0.0.1:5173`.

---

## Verification & Testing

### 1. Full Production Hardening Suite (140 Concurrent Students)
```bash
cd backend
.venv/bin/python3 test_full_production_hardening.py
```

### 2. Admin Control Deck Regression Suite
```bash
cd backend
.venv/bin/python3 test_admin_deck_regression.py
```

### 3. Frontend TypeScript Compilation
```bash
cd frontend/apps/web
npm run build
```

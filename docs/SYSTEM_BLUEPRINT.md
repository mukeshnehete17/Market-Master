# Market Master — Master System Architecture Blueprint (MVP)

**Document Version**: 2.0.0 (Production Architecture Freeze)  
**Status**: APPROVED & FROZEN  
**Target Runtime**: Supabase Managed PostgreSQL + Python Flask API + React 19 / TypeScript SPA (Vite)

---

## 1. Executive Summary & Product Definition
**Market Master** is a high-conviction, financial-market-style educational competition platform. It transforms standard quiz mechanics into a live financial simulation where participants act as market traders, allocating virtual capital against probabilistic questions under real-time market dynamics.

- **Single Source of Truth**: Supabase Managed PostgreSQL.
- **Architectural Tenet**: Strict separation of concerns between presentation, business logic, data access, and database integrity.
- **Pedagogical Control**: The competition pacing is strictly host-driven; questions are dispatched one-by-one with authoritative host controls for market close, answer reveal, and balance settlement.

---

## 2. Actors & Permissions Summary
1. **Admin / Host**:
   - Manages question repository, configures game instances, assigns questions, and conducts live competitions.
   - Has exclusive access to `/api/admin/*` routes.
2. **Trader / Student**:
   - Authenticated student who joins a competition via a 6-character Game PIN.
   - Commits risk allocations against virtual capital and reviews performance.
   - Accesses `/api/game/*` routes with sanitized payloads.
3. **System Engine**:
   - Executes atomic settlements, ledger updates, and timeout recording.

---

## 3. Core MVP Feature Set
- **Authentication**: Email/password signup, login, session cookies + Bearer token fallback.
- **Question Bank**: Full CRUD with 4 multiple-choice options, correct key, category, explanation, and duration (5–300s).
- **Game Engine**: Game creation with custom/auto PIN, starting capital, risk parameters (e.g. 10%–75%), and ordered question assignment.
- **Live Market Desk**: Dense, high-signal command center with real-time participant counts, order books, and sentiment breakdown.
- **Host Dispatch**: Manual one-by-one question dispatch (no uncontrolled auto-progression).
- **Position Execution**: Conviction-based risk allocation against virtual capital with client-side preview and server-side validation.
- **Atomic Settlement**: Idempotent balance adjustments with immutable transaction ledger entries (`transactions`).
- **Leaderboard**: High-speed batch ranking with multi-factor tie-breaking and Top 3 podium standings.
- **Audit Trail**: Immutable administrative event logging (`admin_actions`).

---

## 4. Workflows & State Machines

### Game Lifecycle
$$\text{draft} \longrightarrow \text{waiting} \longrightarrow \text{live} \longrightarrow \text{completed}$$

### Round Lifecycle
$$\text{pending} \xrightarrow{\text{Admin: publish}} \text{question\_open} \xrightarrow{\text{Admin: close\_market}} \text{market\_closed} \xrightarrow{\text{Admin: reveal}} \text{result} \xrightarrow{\text{Admin: settle}} \text{settled}$$

---

## 5. Domain & Database Architecture
All database records utilize RFC 4122 v4 UUIDs generated via `gen_random_uuid()`:
- `profiles`: User credentials, roles, and account status.
- `questions`: Question repository with answers and explanations.
- `games`: Competition instances with unique PINs and risk parameters.
- `game_questions`: Ordered join table linking questions to games.
- `rounds`: Live round states and event timestamps.
- `game_players`: Player enrollment, current capital, score, and net P/L.
- `answers`: Trader selected options per round.
- `positions`: Locked financial risk allocations and settlements per round.
- `transactions`: Immutable balance ledger.
- `admin_actions`: Administrative audit trail.

---

## 6. Backend & API Architecture
- **Layered Architecture**: Route handlers authenticate and validate, then delegate to service modules (`game_engine.py`, `admin_service.py`, `questions_service.py`), which query Supabase via the typed data gateway (`game_store.py`, `supabase_db.py`).
- **Standardized Response Envelope**: All endpoints return `{"success": true, ...}` or `{"success": false, "message": "...", "error": {...}}`.
- **Strict ID Segregation**: Human-facing 6-character PIN used exclusively for joining; canonical UUIDs used for all internal queries.

---

## 7. Frontend Architecture & Performance
- **React 19 + TypeScript + Vite**.
- **Instant Tab Switching (0ms)**: Persistent DOM mounting across all 9 Admin tabs prevents unmounting and full-page loading spinners.
- **State Synchronization**: Dual `localStorage` (auth token) and `sessionStorage` (admin selected game ID).
- **Jittered Polling**: 1,500ms polling interval with $\pm 200\text{ms}$ random jitter prevents thundering-herd spikes from 140+ students.
- **Authoritative Countdown**: Client derives remaining time from server epoch timestamp, eliminating client clock drift.

---

## 8. Security & Defense-in-Depth
- **Answer Secrecy**: The backend strictly strips `correct_option` and `explanation` from active round responses.
- **RLS Lockdown**: Row Level Security is active in deny-by-default mode across all 12 Supabase tables.
- **Secret Isolation**: Service-role keys are accessible exclusively in the backend runtime.
- **Idempotency**: Composite unique constraints physically prevent duplicate bids or double-settlement.

---

## 9. Observability & Failure Recovery
- **Session Auto-Recovery**: Both admin and students restore exact in-flight game state upon browser refresh.
- **Controlled 503**: Database network disruptions trigger a clean HTTP 503 Service Unavailable banner without crashing the frontend.
- **Telemetry**: Key lifecycle transitions are logged with structured context.

---

## 10. Automated Testing & Verification Standards
- **Load / Concurrency Verification**: 140 concurrent student simulation verifies joining, active countdowns, simultaneous bid submissions, market closure, and settlement math (**33/33 PASSED**).
- **Admin Control Deck Regression**: End-to-end verification of question persistence, game creation, round progression, answer secrecy, and cleanup (**31/31 PASSED**).
- **Static Verification**: `npm run build` compiles cleanly with zero TypeScript errors.

---

## 11. Target Project Layout & Safe Migration Plan
To eliminate nested paths, dead prototypes, and confusing directory names, the repository will be structured as:
- `/backend`: Python Flask API and test suites.
- `/frontend`: React 19 + TypeScript + Vite SPA.
- `/supabase`: SQL migrations and RLS scripts.
- `/docs`: Authoritative engineering specifications and ADRs.
- `vercel.json`: Single-domain root routing ingress.

---

## 12. Rollback Strategy
1. All database migrations are non-destructive and backward compatible.
2. Git commit history guarantees instantaneous rollback to any previous tag if required.
3. Health check endpoints (`/api/health/db`) provide automated verification before traffic switchover.

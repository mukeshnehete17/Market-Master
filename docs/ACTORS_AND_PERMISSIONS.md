# Market Master — System Actors & Permissions

## 1. System Actors

### Actor 1: Host / Admin
- **Role Identifier**: `admin` in `profiles.role`.
- **Identity**: Authenticated system user with verified administrative privileges.
- **Permissions Scope**:
  - Full management of Question Bank (create, read, edit, delete, archive).
  - Full lifecycle control over Games (create, update settings, assign questions, delete drafts, start, pause, resume, close market, reveal answer, settle round, next round, finish game).
  - Real-time observation of all participants, active bids, capital exposures, and order books.
  - Participant moderation (inspect student records, disable/ban compromised accounts).
  - Inspection of immutable audit logs (`admin_actions`).
  - Configuration of global game defaults (`game_settings`).
- **Restrictions**:
  - Admin cannot submit trader answers or take financial positions in a competition they are hosting.
  - Admin cannot modify settled rounds retroactively without audit trail.

### Actor 2: Trader / Student (Participant)
- **Role Identifier**: `participant` in `profiles.role`.
- **Identity**: Authenticated student account.
- **Permissions Scope**:
  - Join active competitions by providing a valid 6-character Game PIN.
  - Submit 1 answer choice and risk percentage per published round before deadline.
  - View sanitized round questions (without answers or explanations until revealed).
  - View own account balance, locked positions, settlement history, and transaction ledger.
  - View public game leaderboard and rankings.
  - Update personal profile callsign/avatar.
- **Restrictions**:
  - Strictly forbidden from accessing any `/api/admin/*` endpoint.
  - Forbidden from inspecting correct answers before `answer_revealed_at`.
  - Cannot submit multiple positions for the same round.
  - Cannot alter past positions or capital balances directly.
  - Cannot view other traders' unrevealed submissions during live rounds.

### Actor 3: System Engine (Internal Background / Transaction Context)
- **Role Identifier**: Backend service role bypassing RLS via Supabase service key.
- **Permissions Scope**:
  - Execute atomic round settlements across multiple tables (`game_players`, `positions`, `transactions`, `rounds`).
  - Enforce timeout penalties on unsubmitted positions.
  - Record audit logs of state transitions.

---

## 2. Permissions Matrix

| Functional Capability | Admin (`admin`) | Student (`participant`) | Unauthenticated Guest | System Engine |
| :--- | :---: | :---: | :---: | :---: |
| **Authentication: Signup / Login / Me** | Yes | Yes | Yes (Public) | N/A |
| **Dashboard Metrics (`/api/admin/dashboard`)** | Yes | No (403) | No (401) | Yes |
| **Market Desk Control (`/api/admin/deck`)** | Yes | No (403) | No (401) | Yes |
| **Question Bank: Read / Create / Edit / Delete** | Yes | No (403) | No (401) | Yes |
| **Games: Create / Edit / Assign Questions** | Yes | No (403) | No (401) | Yes |
| **Game Control: Start / Close / Reveal / Settle** | Yes | No (403) | No (401) | Yes |
| **Student Management & Status Updates** | Yes | No (403) | No (401) | Yes |
| **Audit Logs Inspection** | Yes | No (403) | No (401) | Yes |
| **Global Settings Config** | Yes | No (403) | No (401) | Yes |
| **Join Game via PIN (`POST /api/game/join`)** | Optional | Yes | No (401) | Yes |
| **Fetch Active Question (`GET /api/game/current`)**| Optional | Yes (Sanitized) | No (401) | Yes |
| **Submit Position (`POST /api/game/submit`)** | No | Yes (Single bid) | No (401) | Yes |
| **Fetch Result / Settlement (`GET /api/game/result`)**| Optional | Yes (Own settled) | No (401) | Yes |
| **Advance Round (`POST /api/game/next`)** | No (Uses deck) | Yes (Sync state) | No (401) | Yes |
| **View Leaderboard (`GET /api/leaderboard`)** | Yes | Yes | No (401) | Yes |
| **View Own History (`GET /api/player/history`)** | Yes | Yes (Own only) | No (401) | Yes |

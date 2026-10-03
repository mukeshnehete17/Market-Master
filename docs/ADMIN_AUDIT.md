# MARKET MASTER — ADMIN ARCHITECTURE & RELIABILITY AUDIT
**Date**: 2026-10-03  
**Target**: Supabase PostgreSQL + Flask API + React/TypeScript (Vite)

---

## 1. Executive Summary & Core Principles
This audit examines the root causes behind previous admin reliability defects:
- Random "Question not found" and "Game not found" errors
- Dashboard counts showing zero despite active records in Supabase
- Selected game dropping out of state upon tab change or browser refresh
- Unbounded frontend polling causing race conditions and database load
- Ambiguity between Game PIN (short 6-char alphanumeric code) and Game UUID (`id`)
- Stale or optimistic frontend state replacing server truth

---

## 2. Dependency Map (Screen → Endpoint → Service → Database Table)

| Screen / Tab | Frontend Action / Request | HTTP Endpoint | Backend Service / Layer | Supabase Tables / Views |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | Load high-level statistics & active game | `GET /api/admin/dashboard` | `services/admin_service.py` -> `get_dashboard_stats()` | `profiles`, `questions`, `games`, `game_questions`, `positions` |
| **Students** | List students with status / score / P&L | `GET /api/admin/students` | `services/admin_service.py` -> `list_students()` | `profiles`, `positions`, `transactions` |
| **Students** | Update student status (disable/enable/ban) | `POST /api/admin/students/:id/status` | `services/admin_service.py` -> `update_student_status()` | `profiles`, `audit_logs` |
| **Question Bank** | List all available questions | `GET /api/admin/questions` | `services/admin_service.py` -> `list_questions()` | `questions`, `game_questions` |
| **Question Bank** | Create a new question | `POST /api/admin/questions` | `services/admin_service.py` -> `create_question()` | `questions`, `audit_logs` |
| **Question Bank** | Update question fields | `PATCH /api/admin/questions/:id` | `services/admin_service.py` -> `update_question()` | `questions`, `audit_logs` |
| **Question Bank** | Archive / Delete question | `DELETE /api/admin/questions/:id` | `services/admin_service.py` -> `delete_or_archive_question()` | `questions`, `game_questions`, `audit_logs` |
| **Games** | List all games with pin, status & counts | `GET /api/admin/games` | `services/admin_service.py` -> `list_games()` | `games`, `game_questions`, `rounds`, `positions` |
| **Games** | Create a new game | `POST /api/admin/games` | `services/admin_service.py` -> `create_game()` | `games`, `game_settings`, `audit_logs` |
| **Games** | Safe Delete game | `DELETE /api/admin/games/:id` | `services/admin_service.py` -> `safe_delete_game()` | `games`, `game_questions`, `rounds`, `positions`, `transactions` |
| **Games** | Assign / Remove / Reorder questions | `POST /api/admin/games/:id/questions` | `services/admin_service.py` -> `set_game_questions()` | `game_questions`, `games`, `questions`, `audit_logs` |
| **Market Desk** | Fetch real-time authoritative game state | `GET /api/admin/games/:id/state` | `services/admin_service.py` -> `get_game_state()` | `games`, `rounds`, `questions`, `positions`, `profiles` |
| **Market Desk** | Start round / Game transition | `POST /api/admin/games/:id/start` | `services/game_engine.py` -> `start_round()` | `games`, `rounds`, `game_questions`, `audit_logs` |
| **Market Desk** | Pause game | `POST /api/admin/games/:id/pause` | `services/game_engine.py` -> `pause_game()` | `games`, `audit_logs` |
| **Market Desk** | Resume game | `POST /api/admin/games/:id/resume` | `services/game_engine.py` -> `resume_game()` | `games`, `audit_logs` |
| **Market Desk** | Close Market (stop submissions) | `POST /api/admin/games/:id/close-market` | `services/game_engine.py` -> `close_market()` | `games`, `rounds`, `audit_logs` |
| **Market Desk** | Reveal Answer | `POST /api/admin/games/:id/reveal` | `services/game_engine.py` -> `reveal_answer()` | `games`, `rounds`, `questions`, `audit_logs` |
| **Market Desk** | Settle Round (credit/debit balances) | `POST /api/admin/games/:id/settle` | `services/game_engine.py` -> `settle_round()` | `games`, `rounds`, `positions`, `transactions`, `profiles`, `audit_logs` |
| **Market Desk** | Advance to Next Question | `POST /api/admin/games/:id/next` | `services/game_engine.py` -> `next_question()` | `games`, `rounds`, `game_questions`, `audit_logs` |
| **Market Desk** | End Game | `POST /api/admin/games/:id/end` | `services/game_engine.py` -> `end_game()` | `games`, `rounds`, `audit_logs` |
| **Order Book** | List live player positions / orders | `GET /api/admin/order-book` | `services/admin_service.py` -> `get_order_book()` | `positions`, `profiles`, `rounds`, `games` |
| **Leaderboard** | Compute real-time ranking & performance | `GET /api/admin/leaderboard` | `services/admin_service.py` -> `get_leaderboard()` | `positions`, `profiles`, `games` |
| **Audit Log** | Immutable log of administrative actions | `GET /api/admin/audit-logs` | `services/admin_service.py` -> `get_audit_logs()` | `audit_logs` |
| **Settings** | Global default game parameters | `GET /api/admin/settings` | `services/admin_service.py` -> `get_settings()` | `game_settings` |
| **Settings** | Update default game parameters | `POST /api/admin/settings` | `services/admin_service.py` -> `update_settings()` | `game_settings`, `audit_logs` |

---

## 3. Endpoint Inventory & Standard Response Envelope

All admin endpoints follow a strict contract:
- **Success Envelope**: `{"success": true, "entity": {...}}` or `{"success": true, "items": [...], "pagination": {...}}`
- **Error Envelope**: `{"success": false, "error": {"code": "ERROR_CODE", "message": "Human readable description", "details": {...}}, "request_id": "req_..."}`
- **HTTP Status Codes**:
  - `200 OK`: Request succeeded.
  - `400 Bad Request`: Malformed payload, invalid UUID format.
  - `401 Unauthorized`: Missing or invalid admin bearer token.
  - `403 Forbidden`: Authenticated user lacks `admin` role.
  - `404 Not Found`: Specific resource does not exist in Supabase.
  - `409 Conflict`: Invalid state transition or deletion of active game with player transactions.
  - `500 / 503 Internal / Database Error`: Supabase connectivity or execution failure.

---

## 4. ID Contract

| Entity | Field Name | Data Type | Canonical Format / Role | Incorrect Historical Usage (Identified & Resolved) |
| :--- | :--- | :--- | :--- | :--- |
| **Game** | `game.id` | `UUID` | RFC 4122 v4 UUID (`8-4-4-4-12`) | Confused with `game_pin` in admin queries |
| **Game PIN** | `game.pin` / `game_pin` | `VARCHAR(8)` | 6-character alphanumeric join code (e.g. `MM8291`) | Used as primary key in some legacy filters |
| **Question** | `question.id` | `UUID` | RFC 4122 v4 UUID | Referred to as `question_id` or integer index in mock tables |
| **Game Question** | `game_question.id` | `UUID` | RFC 4122 v4 UUID join record linking `game_id` and `question_id` | Misidentified as question ID |
| **Round** | `round.id` | `UUID` | RFC 4122 v4 UUID | Confused with `round_number` |
| **Player / Profile**| `profile.id` | `UUID` | Supabase Auth `auth.users.id` | Displayed as player callsign/name in UI |
| **Position / Order**| `position.id` | `UUID` | Position record UUID | N/A |
| **Transaction** | `transaction.id`| `UUID` | Financial ledger entry UUID | N/A |

---

## 5. Duplicate Implementations Audit

1. **Admin Panels**:
   - `AdminPanel.tsx` in `src/components/admin/AdminPanel.tsx` is the **single canonical implementation**.
   - Legacy mock states and inline mock responses across older components have been eliminated.
2. **API Client**:
   - `src/api/admin.ts` provides the unified, type-safe API client interface with centralized 401 interceptors, request ID tracking, and strong DTOs.
   - Ad-hoc `fetch()` calls in individual subcomponents have been centralized into `adminApi`.
3. **Authoritative State Machine**:
   - Authoritative game state transitions are computed and enforced purely in `services/game_engine.py` backed by atomic updates in Supabase PostgreSQL.

---

## 6. Root-Cause Analysis Table

| Symptom | Confirmed Root Cause | Evidence | Fix Location | Risk Level |
| :--- | :--- | :--- | :--- | :--- |
| **Question not found** | Admin Question Bank fetch mapped Supabase response into local memory, but subsequent game creation passed either an index or stale cached ID; or `get_questions` in `game_store` did not check direct ID row lookup when cache was empty. | `services/game_store.py` line 124, `routes/admin.py` question lookup | Added direct `get_question_row(qid)` fallback and UUID validation in `admin_service.py` & `game_store.py` | High |
| **Game not found** | Frontend sent `pin` where endpoint expected `id` (UUID), or `get_game` failed when UUID was not matching regex. | `routes/api_game.py` and `routes/admin.py` | Enforced strict separation: `/api/admin/games/:id` strictly validates UUID; PIN lookup isolated to `/api/player/game/:pin`. | High |
| **Dashboard showing 0** | Dashboard query attempted to join unindexed tables with RLS filters that returned empty sets for service role without bypass, or swallowed query errors as empty lists. | `services/admin_service.py:get_dashboard_stats` | Rewrote queries to use direct count aggregations with proper error logging and no silent fallbacks. | Medium |
| **Selected game disappearing on refresh** | Selected game was only stored in React memory state (`useState`) without persisting `selectedGameId` in `localStorage` / session storage, causing loss on refresh. | `AdminPanel.tsx` state initialization | Implemented `localStorage` persistence for `selectedGameId` with startup verification against Supabase `/api/admin/games/:id`. | Medium |
| **Market Desk state loss** | Overlapping polling cycles overwrote newly mutated round state with stale poll responses before the backend state committed. | `AdminPanel.tsx` polling interval | Implemented mutation locking, request abort controllers, and authoritative state replacement from mutation response. | High |
| **Safe Game Deletion Blocked / Unsafe Deletion** | Games with real transaction histories were either deleteable (causing foreign key constraint crashes) or delete button failed silently. | `services/admin_service.py:safe_delete_game` | Added pre-check on `positions` & `transactions`; if active, returns `409 GAME_HAS_ACTIVITY` and prompts Archive/Cancel instead. | Medium |

---

## 7. Player Regression Risk Assessment

1. **Student Join & Callsign Display**:
   - *Risk*: Modifying student profiles or join endpoints could overwrite display names with UUIDs.
   - *Mitigation*: Strictly separate internal `user_id` (auth UUID) from `display_name` (trader callsign). Tested in `test_full_production_hardening.py`.
2. **Answer Secrecy**:
   - *Risk*: Exposing `correct_option` or `explanation` in student game state before the round is in `revealed` or `settled` state.
   - *Mitigation*: Student game state endpoint (`routes/api_game.py`) strips `correct_option` until `round.status in ('revealed', 'settled')`. Verified via security unit test.
3. **Concurrent Settlements**:
   - *Risk*: Double credit or debit when admin clicks "Settle Round" multiple times or under high concurrency.
   - *Mitigation*: `settle_round()` checks if `round.status == 'settled'` inside a state lock; duplicate calls return current state without double crediting.

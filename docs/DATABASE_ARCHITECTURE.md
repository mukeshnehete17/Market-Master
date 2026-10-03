# Market Master — Database Architecture

## 1. Engine & Strategy
- **Database Engine**: PostgreSQL on Supabase.
- **Access Model**: Service Role key used exclusively by Flask backend.
- **Client Security**: Row Level Security (RLS) is enabled in deny-by-default mode across all application tables. Direct browser access to database tables is disallowed; all interaction routes through Flask API endpoints.
- **Primary Key Strategy**: RFC 4122 v4 UUIDs generated via `gen_random_uuid()` (using `pgcrypto`).
- **Timestamps**: All timestamps are `TIMESTAMPTZ` with default `now()`.

---

## 2. Table Indexing & Performance Design

| Table | Primary Key | Foreign Keys | Unique Constraints | Performance Indexes |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | `id` (UUID) | None | `email` | `idx_profiles_email`, `idx_profiles_role`, `idx_profiles_status` |
| `game_settings` | `id` (UUID) | None | None | None (single global config row) |
| `questions` | `id` (UUID) | None | None | `idx_questions_category`, `idx_questions_is_active` |
| `games` | `id` (UUID) | `created_by -> profiles(id)` | `game_pin` | `idx_games_pin`, `idx_games_status` |
| `game_questions` | `id` (UUID) | `game_id -> games`, `question_id -> questions` | `(game_id, round_number)` | `idx_game_questions_game` |
| `rounds` | `id` (UUID) | `game_id -> games`, `question_id -> questions` | `(game_id, round_number)` | `idx_rounds_game_status` |
| `game_players` | `id` (UUID) | `game_id -> games`, `user_id -> profiles` | `(game_id, user_id)` | `idx_game_players_game_capital`, `idx_game_players_user` |
| `answers` | `id` (UUID) | `round_id -> rounds`, `game_id -> games`, `user_id -> profiles` | `(round_id, user_id)` | `idx_answers_round_user` |
| `positions` | `id` (UUID) | `round_id -> rounds`, `game_id -> games`, `user_id -> profiles` | `(round_id, user_id)` | `idx_positions_round_user` |
| `transactions` | `id` (UUID) | `game_id -> games`, `user_id -> profiles`, `round_id -> rounds` | None (ledger append-only) | `idx_transactions_game_user` |
| `leaderboard_snapshots` | `id` (UUID) | `game_id -> games`, `user_id -> profiles` | None | `idx_leaderboard_game_rank` |
| `admin_actions` | `id` (UUID) | `admin_user_id -> profiles` | None | `idx_admin_actions_created` |

---

## 3. Transaction Safety & Idempotency Rules
1. **Double Submission Prevention**: The composite unique index on `answers(round_id, user_id)` and `positions(round_id, user_id)` physically prevents a student from recording more than one trade per round at the database level.
2. **Duplicate Settlement Prevention**: The backend verifies `rounds.status != 'settled'` before initiating settlement. All position updates and transaction ledger writes execute in a single atomic flow.
3. **Safe Deletion Cascade**:
   - `games`: Cascades to `game_questions`, `rounds`, `game_players`, `answers`, `positions`, `transactions`.
   - `questions`: `ON DELETE RESTRICT` protects against deleting questions assigned to active games.

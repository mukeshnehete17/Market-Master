# Market Master — Observability & Logging Architecture

## 1. Structured Logging Policy
- **Format**: Structured key-value / JSON logging output to standard error/out.
- **Log Levels**:
  - `DEBUG`: Verbose query parameters in development.
  - `INFO`: Standard lifecycle events (game created, round published, round settled, player joined).
  - `WARNING`: Recoverable failures (slow query, player duplicate bid attempt).
  - `ERROR`: Unhandled exceptions, database query failures, settlement reconciliation discrepancies.
- **Data Protection**:
  - Passwords, password hashes, `SUPABASE_SERVICE_ROLE_KEY`, and session secrets MUST NEVER be written to logs.

---

## 2. Key Telemetry & Audit Events

| Event Name | Service Location | Log Level | Payload Keys |
| :--- | :--- | :---: | :--- |
| `auth.login.success` | `services/auth_service.py` | `INFO` | `user_id`, `email`, `role`, `timestamp` |
| `auth.login.failed` | `services/auth_service.py` | `WARNING` | `email`, `reason`, `timestamp` |
| `game.created` | `services/admin_service.py` | `INFO` | `game_id`, `game_pin`, `admin_id`, `total_questions` |
| `round.published` | `services/game_engine.py` | `INFO` | `game_id`, `round_number`, `question_id`, `deadline` |
| `position.locked` | `services/game_engine.py` | `INFO` | `game_id`, `round_number`, `user_id`, `risk_pct`, `bid_amount` |
| `market.closed` | `services/game_engine.py` | `INFO` | `game_id`, `round_number`, `submissions_count` |
| `round.settled` | `services/game_engine.py` | `INFO` | `game_id`, `round_number`, `winners_count`, `losers_count`, `total_payout` |
| `database.error` | `services/supabase_db.py` | `ERROR` | `table`, `operation`, `error_message`, `duration_ms` |

---

## 3. Immutable Administrative Audit Trail (`admin_actions`)
All administrative interventions are recorded in the PostgreSQL `admin_actions` table:
- `admin_user_id`: UUID of acting administrator.
- `action`: Canonical event identifier (e.g. `game.start`, `round.settle`, `question.delete`, `student.disable`).
- `entity_type`: Target entity category (`game`, `question`, `student`, `settings`).
- `entity_id`: Identifier of targeted record.
- `metadata`: JSONB snapshot of change parameters.
- `created_at`: Immutable UTC timestamp.

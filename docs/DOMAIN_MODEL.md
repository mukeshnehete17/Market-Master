# Market Master — Domain Model

## 1. Domain Entities & ER Relationships

```
              ┌───────────────┐
              │    Profile    │ (User / Admin)
              └───────┬───────┘
                      │ 1:N
        ┌─────────────┼─────────────┐
        │ 1:N         │ 1:N         │ 1:N
        ▼             ▼             ▼
  ┌───────────┐ ┌───────────┐ ┌───────────────┐
  │   Game    │ │GamePlayer │ │ AdminAction   │
  └─────┬─────┘ └─────┬─────┘ └───────────────┘
        │ 1:N         │
        ├─────────────┼─────────────────────────┐
        ▼             │ 1:N                     │ 1:N
  ┌───────────┐       ▼                         ▼
  │GameQuest. │ ┌───────────┐             ┌───────────┐
  └─────┬─────┘ │  Answer   │             │ Position  │
        │ N:1   └─────▲─────┘             └─────▲─────┘
        ▼             │ 1:N                     │ 1:N
  ┌───────────┐       │                         │
  │ Question  │       │                         │
  └─────▲─────┘       │                         │
        │ N:1         │                         │
  ┌─────┴─────┐       │                         │
  │   Round   ├───────┴─────────────────────────┘
  └─────┬─────┘
        │ 1:N
        ▼
  ┌───────────┐
  │Transaction│ (Ledger)
  └───────────┘
```

---

## 2. Entity Specifications

### 1. `Profile`
- **Purpose**: Authenticated user record for students and administrators.
- **Fields**: `id` (UUID, PK), `name` (TEXT), `email` (TEXT, Unique), `password_hash` (TEXT), `role` (`'participant' | 'admin'`), `avatar` (TEXT), `status` (`'active' | 'disabled' | 'banned'`), `created_at` (TIMESTAMPTZ).

### 2. `Question`
- **Purpose**: Financial market intelligence multiple-choice question.
- **Fields**: `id` (UUID, PK), `question_text` (TEXT), `option_a` (TEXT), `option_b` (TEXT), `option_c` (TEXT), `option_d` (TEXT), `correct_option` (TEXT: 'A'|'B'|'C'|'D'), `explanation` (TEXT), `category` (TEXT), `duration_seconds` (INT, 5–300), `is_active` (BOOL).

### 3. `Game`
- **Purpose**: A live competition instance.
- **Fields**: `id` (UUID, PK), `game_pin` (TEXT, Unique, 6 chars), `name` (TEXT), `status` (`'draft'|'waiting'|'live'|'paused'|'market_closed'|'completed'|'cancelled'`), `starting_capital` (NUMERIC), `min_risk` (NUMERIC), `max_risk` (NUMERIC), `default_question_duration` (INT), `created_by` (UUID -> Profile), `created_at`, `started_at`, `ended_at`.

### 4. `GameQuestion`
- **Purpose**: Ordered mapping of questions to a specific game.
- **Fields**: `id` (UUID, PK), `game_id` (UUID -> Game), `question_id` (UUID -> Question), `round_number` (INT), `duration_seconds` (INT). Unique on `(game_id, round_number)`.

### 5. `Round`
- **Purpose**: Real-time state of an individual question round during a live game.
- **Fields**: `id` (UUID, PK), `game_id` (UUID -> Game), `round_number` (INT), `question_id` (UUID -> Question), `status` (`'pending'|'question_open'|'market_open'|'market_closed'|'result'|'settled'`), `started_at`, `market_closed_at`, `answer_revealed_at`, `settled_at`.

### 6. `GamePlayer`
- **Purpose**: Enrollment of a student into a game with their current financial balance.
- **Fields**: `id` (UUID, PK), `game_id` (UUID -> Game), `user_id` (UUID -> Profile), `current_capital` (NUMERIC), `starting_capital` (NUMERIC), `total_profit_loss` (NUMERIC), `score` (INT), `status` (`'active'|'bankrupt'|'left'|'finished'`), `joined_at`. Unique on `(game_id, user_id)`.

### 7. `Answer` & `Position`
- **Purpose**: Student's answer choice and financial commitment for a specific round.
- **Answer Fields**: `id` (UUID, PK), `round_id` (UUID -> Round), `game_id` (UUID -> Game), `user_id` (UUID -> Profile), `selected_option` (TEXT), `is_correct` (BOOL), `submitted_at`, `timed_out` (BOOL). Unique on `(round_id, user_id)`.
- **Position Fields**: `id` (UUID, PK), `round_id` (UUID -> Round), `game_id` (UUID -> Game), `user_id` (UUID -> Profile), `risk_percent` (NUMERIC), `bid_amount` (NUMERIC), `multiplier` (NUMERIC), `potential_profit` (NUMERIC), `potential_loss` (NUMERIC), `result` (`'pending'|'win'|'loss'|'timeout'`), `profit_loss` (NUMERIC), `settled_at`. Unique on `(round_id, user_id)`.

### 8. `Transaction`
- **Purpose**: Immutable financial ledger recording all credits and debits to player capital.
- **Fields**: `id` (UUID, PK), `game_id` (UUID -> Game), `user_id` (UUID -> Profile), `round_id` (UUID -> Round), `type` (`'starting_capital'|'risk_lock'|'profit'|'loss'|'adjustment'|'refund'`), `amount` (NUMERIC), `balance_after` (NUMERIC), `created_at`.

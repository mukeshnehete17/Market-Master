# Market Master — MVP Feature Specification

## Feature Directory

### A. Authentication & Session Management
- **Purpose**: Authenticate users, verify credentials, issue session tokens, and enforce role separation.
- **Actor**: All users (Admin & Student).
- **Preconditions**: Valid email and secure password (minimum 6 characters).
- **Backend Responsibility**: Validate credentials against PBKDF2/bcrypt hash in `profiles.password_hash`, issue HTTP-only session cookie and JWT Bearer token, protect service-role credentials.
- **Frontend Responsibility**: Maintain token in `localStorage`, sync auth status on mount via `GET /api/auth/me`, handle automatic logout on 401.
- **Database Entities**: `profiles`.
- **Success State**: HTTP 200 with user profile and token.
- **Failure State**: HTTP 400 (validation), 401 (invalid credentials), 403 (disabled/banned).

---

### B. Question Bank Management
- **Purpose**: Enable hosts to curate, categorize, and configure financial questions.
- **Actor**: Admin.
- **Preconditions**: Admin authentication.
- **Inputs**: `question_text`, `option_a`, `option_b`, `option_c`, `option_d`, `correct_option` (A/B/C/D), `category`, `duration_seconds`, `explanation`.
- **Backend Responsibility**: Validate all 4 options exist, duration is between 5 and 300 seconds, correct option is valid; insert/update row in `questions` table; record audit log.
- **Frontend Responsibility**: Form validation, list pagination, interactive edit modal, inline error toasts.
- **Database Entities**: `questions`, `admin_actions`.
- **Success State**: HTTP 201 Created with persisted question UUID.
- **Failure State**: HTTP 400 Bad Request if options missing; HTTP 409 if assigned to live game during delete.

---

### C. Game Lifecycle & Question Assignment
- **Purpose**: Configure a multi-round competition instance with specific risk parameters and assigned questions.
- **Actor**: Admin.
- **Inputs**: `name`, `game_pin` (optional auto-generation), `starting_capital`, `min_risk`, `max_risk`, `default_question_duration`, `question_ids`.
- **Backend Responsibility**: Generate unique 6-character PIN, insert row into `games`, create ordered 1-to-N join rows in `game_questions`, log action.
- **Frontend Responsibility**: Selection interface with drag-and-drop or select-to-add questions, instant "Open in Market Desk" quick-link.
- **Database Entities**: `games`, `game_questions`, `admin_actions`.
- **Success State**: Game created with `status="draft"` or `"waiting"`.

---

### D. Manual One-by-One Round Publishing (Host Control)
- **Purpose**: Prevent questions from dispatching automatically to students; allow the host to explain context and publish rounds one by one.
- **Actor**: Admin.
- **Preconditions**: Game status is `waiting` or previous round has settled.
- **Execution Flow**:
  1. `start` / `next_round`: Creates row in `rounds` with `status="question_open"` / `"market_open"`.
  2. Students polling `/api/game/current` transition from `waiting` to `question`.
  3. Host clicks `close_market`: Round transitions to `market_closed`. Submissions are locked.
  4. Host clicks `reveal`: Round transitions to `result`. Solution and explanation become available.
  5. Host clicks `settle`: P/L is computed atomically for all participants.
- **Database Entities**: `games`, `rounds`, `positions`, `game_players`.

---

### E. Risk Allocation & Position Execution
- **Purpose**: Enable students to commit virtual capital to their chosen answer based on conviction.
- **Actor**: Student.
- **Preconditions**: Active round with `status="market_open"` and current server timestamp < `deadline`.
- **Inputs**: `question_id`, `selected_option` (A, B, C, D), `risk_percent` (within min/max risk limits).
- **Backend Responsibility**:
  - Verify player belongs to game and is `active`.
  - Validate `risk_percent` $\in [\text{min\_risk}, \text{max\_risk}]$.
  - Compute $\text{bid\_amount} = \text{current\_capital} \times (\text{risk\_percent} / 100)$.
  - Check idempotency: if position already exists for this round, reject with 409 Conflict.
  - Insert row in `answers` and `positions`.
- **Frontend Responsibility**: Interactive slider/chips for risk percentage, real-time potential profit/loss preview, confirmation feedback, locking overlay.
- **Database Entities**: `answers`, `positions`.

---

### F. Authoritative Round Settlement
- **Purpose**: Calculate accurate balance updates and record financial ledger transactions.
- **Actor**: System / Admin trigger.
- **Execution**:
  - Compare `positions.selected_option` with `questions.correct_option`.
  - If correct: $\text{profit} = \text{bid\_amount} \times \text{multiplier}$, $\text{capital} \leftarrow \text{capital} + \text{profit}$, $\text{score} \leftarrow \text{score} + 1$.
  - If incorrect: $\text{loss} = \text{bid\_amount} \times \text{multiplier}$, $\text{capital} \leftarrow \text{capital} - \text{loss}$.
  - If timed out: Record zero profit/loss or penalty; decrement if rule dictates.
  - Insert rows into `transactions` ledger (`type="profit"` or `"loss"`).
  - Update `game_players` current capital, total P/L, and score.
- **Database Entities**: `positions`, `game_players`, `transactions`, `rounds`.

---

### G. Real-time Multi-Factor Leaderboard
- **Purpose**: Display live competition standings with fair tie-breaking.
- **Actor**: Admin and Student.
- **Sorting Algorithm**:
  $$\text{Sort} = (\text{Current Capital} \downarrow, \text{Score} \downarrow, \text{Net P/L} \downarrow, \text{Win Rate \%} \downarrow)$$
- **Performance**: Batched query joining `game_players`, `answers`, and `profiles` in $\le 3$ round trips.
- **Badges**:
  - Rank 1: `👑 Market Leader`
  - Ranks 2–3: `🏆 Top Trader`
  - Win rate $\ge 75\%$ with $\ge 2$ rounds: `🎯 High Accuracy`
  - Positive P/L: `📈 In The Green`
  - Negative P/L: `📉 Drawdown`

---

### H. Audit Trail & Moderation
- **Purpose**: Ensure institutional integrity and full trace of administrative interventions.
- **Actor**: Admin.
- **Database Entities**: `admin_actions`.
- **Logged Events**: Question create/edit/delete, game create/edit/delete/state-transition, student disable/enable, settings update.

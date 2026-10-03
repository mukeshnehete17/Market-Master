# Market Master — Game & Round State Machine

## 1. Hierarchy: Game State vs. Round State

The Market Master lifecycle separates overall **Game State** from individual **Round State**:

```
Game State:
  [draft] ──> [waiting] ──> [live] ──> [completed]
                              │   ▲
                              ▼   │
                            [paused]
```

Within a **`live`** game, each round executes the sequential round state machine:

```
Round State:
  [pending]
     │ (Admin publishes question)
     ▼
  [question_open] / [market_open]
     │ (Admin closes market OR timer expires)
     ▼
  [market_closed]
     │ (Admin clicks reveal answer)
     ▼
  [result]
     │ (Admin clicks settle)
     ▼
  [settled] ──> Advance to Round N+1 OR Complete Game
```

---

## 2. Authoritative Transition Table

| Current Round State | Action | Next Round State | Triggering Actor | Preconditions | Side Effects & DB Operations |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `pending` | `start` / `publish` | `question_open` | Admin | Game is `live` or `waiting`, questions assigned | Inserts row in `rounds` table, sets `started_at = now()`, broadcasts round number |
| `question_open` | `pause` | `paused` | Admin | Round is currently open | Locks countdown timer, prevents submission |
| `paused` | `resume` | `question_open` | Admin | Round was paused | Adjusts deadline by pause duration |
| `question_open` | `close_market` | `market_closed` | Admin / Timer | Current state is `question_open` | Sets `rounds.market_closed_at = now()`, locks positions |
| `market_closed` | `reveal` | `result` | Admin | Market is closed | Sets `rounds.answer_revealed_at = now()`, reveals correct option & explanation |
| `result` | `settle` | `settled` | Admin | Answer revealed, not yet settled | Computes win/loss, updates `game_players.current_capital`, writes `transactions` ledger |
| `settled` | `next_round` | `question_open` | Admin | Current round < Total rounds | Increments current round, creates new round record |
| `settled` | `end_game` | `completed` | Admin | Final round reached | Sets `games.status = 'completed'`, archives standings |

---

## 3. Forbidden Transitions & Guardrails
- **No Backward Jumps**: Once a round is `settled`, it cannot revert to `question_open` or `market_closed`.
- **No Early Reveal**: Cannot reveal correct option while round is `question_open`.
- **No Premature Settlement**: Cannot settle a round before revealing the answer.
- **No Student Auto-Progression**: Students cannot trigger `ensure_round(create=True)` — only authoritative host requests can create rounds.
- **Idempotent Settlement**: Settle endpoint verifies `status != 'settled'` to strictly prevent duplicate crediting/debiting of capital balances.

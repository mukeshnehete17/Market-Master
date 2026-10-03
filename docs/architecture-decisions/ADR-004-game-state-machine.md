# ADR-004: Host-Driven Authoritative Round State Machine

## 1. Context & Problem
In earlier iterations, questions were automatically advanced or created whenever a student polled `/api/game/current` or `/api/game/next`. This created chaotic, desynchronized states where different students were on different questions, and hosts had no pedagogical control over the pacing of the market simulation.

## 2. Decision
1. In `services/game_engine.py`, make `ensure_round()` default to `create=False`. Student requests can never instantiate or open subsequent rounds.
2. The host has exclusive authority to publish rounds one-by-one via `POST /api/admin/games/:id/control` with operations:
   `start` -> `close_market` -> `reveal` -> `settle` -> `next_round` -> `end`.
3. If an admin has not yet published the next round, student clients receive a synchronized waiting state: `"Waiting for host to publish Question X..."`.

## 3. Consequences
- **Positive**: Strict synchronization across all students, host maintains full control of the room, and zero orphan rounds are created.
- **Negative**: The host must manually click or automate the progression through each round.

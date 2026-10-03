# ADR-005: Standardized Envelopes & Strict Separation of Game ID vs PIN

## 1. Context & Problem
Earlier API calls conflated the 6-character alphanumeric `game_pin` (e.g. `HF99F3`) with the canonical PostgreSQL UUID `id`. In several endpoints, passing a PIN where a UUID was expected caused silent query failures or 500 errors. Furthermore, disparate error formats made frontend error handling fragile.

## 2. Decision
1. Standardize all API responses to `{ "success": boolean, "data" | "entity" | "message" | "error" }`.
2. Strictly enforce ID roles:
   - `game_pin`: Exclusively used by students to locate and join a game via `POST /api/game/join`.
   - `game.id` (UUID): Exclusively used for internal relationships, database joins, and administrative endpoints (`/api/admin/games/:id`).
3. Admin endpoints strictly validate UUID formats with regex and reject malformed identifiers with HTTP 400 Bad Request.

## 3. Consequences
- **Positive**: Zero ambiguity, clean typing in TypeScript DTOs, and predictable client-side error handling.
- **Negative**: Client code must maintain awareness of both the human-facing PIN and the internal UUID.

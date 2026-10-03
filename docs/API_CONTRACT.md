# Market Master — API Contract Specification

## 1. Global Standard Response Envelopes

### Success Envelope
```json
{
  "success": true,
  "data": {},
  "message": "Optional human-readable confirmation"
}
```

### Error Envelope
```json
{
  "success": false,
  "message": "Human-readable description of the error",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {}
  }
}
```

---

## 2. Authentication Endpoints

### `POST /api/auth/signup`
- **Auth**: Public
- **Request Body**:
  ```json
  { "name": "Alice Trader", "email": "alice@example.com", "password": "securePassword123" }
  ```
- **Response (201)**:
  ```json
  { "success": true, "token": "jwt_...", "user": { "id": "uuid", "name": "Alice Trader", "email": "alice@example.com", "role": "participant" } }
  ```
- **Errors**: 400 (Validation), 409 (Email exists).

### `POST /api/auth/login`
- **Auth**: Public
- **Request Body**:
  ```json
  { "email": "alice@example.com", "password": "securePassword123" }
  ```
- **Response (200)**: Same envelope as signup.
- **Errors**: 400 (Validation), 401 (Invalid credentials).

### `GET /api/auth/me`
- **Auth**: Bearer Token or Session Cookie
- **Response (200)**:
  ```json
  { "success": true, "user": { "id": "uuid", "name": "Alice Trader", "email": "alice@example.com", "role": "participant" } }
  ```
- **Errors**: 401 (Unauthenticated).

---

## 3. Student / Game Endpoints

### `POST /api/game/join`
- **Auth**: Required (`participant` or `admin`)
- **Request Body**:
  ```json
  { "game_code": "HF99F3", "avatar": "🦊" }
  ```
- **Response (200)**:
  ```json
  { "success": true, "game_code": "HF99F3", "player": { "name": "Alice", "capital": 10000, "avatar": "🦊" } }
  ```
- **Errors**: 400 (Invalid PIN), 404 (Game not found).

### `GET /api/game/current`
- **Auth**: Required
- **Response (200)**:
  ```json
  {
    "success": true,
    "game_state": "question", // "waiting" | "question" | "market_closed" | "result" | "gameover"
    "game_code": "HF99F3",
    "round": {
      "current_number": 1,
      "total_questions": 5,
      "deadline": 1790965800.0,
      "time_remaining": 14,
      "question": {
        "id": "uuid",
        "question": "What is Quantitative Easing?",
        "options": ["A. Central bank asset buying", "B. Tax cuts", "C. Tariff increase", "D. Interest hike"],
        "category": "Macroeconomics",
        "duration_seconds": 15
      }
    },
    "player": { "name": "Alice", "current_capital": 10000, "score": 0 }
  }
  ```
- **Critical Security Rule**: `correct_option` and `explanation` MUST NEVER be present in this payload while round is in progress!

### `POST /api/game/submit`
- **Auth**: Required
- **Request Body**:
  ```json
  {
    "question_id": "uuid",
    "selected_option": "A",
    "risk_percent": 25
  }
  ```
- **Response (200)**:
  ```json
  {
    "success": true,
    "pending_position": {
      "selected_option": "A",
      "risk_percent": 25,
      "bid_amount": 2500,
      "potential_profit": 2500,
      "potential_loss": 2500
    }
  }
  ```
- **Errors**: 400 (Invalid option or risk out of bounds), 409 (Already submitted position for this round).

### `GET /api/game/result`
- **Auth**: Required
- **Response (200)**:
  ```json
  {
    "success": true,
    "result": {
      "is_correct": true,
      "selected_option": "A",
      "correct_option": "A",
      "explanation": "Quantitative Easing involves central banks purchasing assets to inject liquidity.",
      "profit_loss": 2500,
      "capital": 12500,
      "score": 1
    }
  }
  ```

---

## 4. Admin Command Endpoints

### `GET /api/admin/deck?game_id=<uuid>`
- **Auth**: Required (`role == 'admin'`)
- **Response (200)**: Full authoritative control deck state including participants, sentiment breakdown, order book, current question with solution, and recent actions.

### `POST /api/admin/games/<id>/control`
- **Auth**: Required (`role == 'admin'`)
- **Request Body**:
  ```json
  { "operation": "start" } // "start" | "pause" | "resume" | "close_market" | "reveal" | "settle" | "next_round" | "end"
  ```
- **Response (200)**: Updated game state object.
- **Errors**: 400 (Invalid operation), 404 (Game not found), 409 (Invalid transition).

### `GET /api/admin/questions`
- **Auth**: Required (`role == 'admin'`)
- **Response (200)**: List of all questions.

### `POST /api/admin/questions`
- **Auth**: Required (`role == 'admin'`)
- **Request Body**:
  ```json
  {
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_option": "B",
    "category": "Equities",
    "duration_seconds": 20,
    "explanation": "..."
  }
  ```
- **Response (201)**: Created question object with persisted UUID.

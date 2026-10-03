# Market Master — End-to-End Acceptance Criteria

## 1. What Defines "End-to-End Complete"
A feature is considered **DONE** only when the complete vertical slice is verified:
$$\text{User Action} \longrightarrow \text{Frontend UI} \longrightarrow \text{HTTP Client} \longrightarrow \text{Flask Route} \longrightarrow \text{Service Engine} \longrightarrow \text{PostgreSQL} \longrightarrow \text{Response} \longrightarrow \text{UI Update} \longrightarrow \text{Persistence on Refresh}$$

---

## 2. Core Feature Acceptance Checklist

### 1. Question Bank Lifecycle
- [x] Host can create a question with text, 4 options, correct key, explanation, duration, and category.
- [x] Question receives a real RFC 4122 v4 UUID from PostgreSQL.
- [x] Question remains visible after navigating to Dashboard, Games, or Market Desk and returning to Question Bank.
- [x] Question remains visible after full page refresh.
- [x] Question can be edited, archived, or safely deleted if not bound to an active game.

### 2. Game Creation & Question Assignment
- [x] Host can create a game with custom or auto-generated 6-character PIN.
- [x] Host can assign multiple questions in explicit sequential order (Round 1, Round 2, ...).
- [x] Backend inserts atomic join records in `game_questions` without "Question not found" errors.
- [x] UI immediately offers an "⚡ Open in Market Desk" button.
- [x] Market Desk displays the exact question count (`Assigned Questions = N`) and format (`ROUND 01 / 0N`).

### 3. Student Joining & Session Stability
- [x] Student can enter the 6-character PIN to join the live waiting room.
- [x] Student's display name shows their real profile callsign (never internal UUID).
- [x] Student can refresh the browser in the waiting room and resume without re-entering the PIN.
- [x] Host sees live participant count update in the Market Desk.

### 4. Controlled Question Dispatch (No Auto-Progression)
- [x] Students do NOT receive questions automatically.
- [x] Host clicks `📢 PUBLISH QUESTION 1 (SEND TO STUDENTS)`.
- [x] Round transitions to `question_open` in Supabase; students receive question within 1.5s poll.
- [x] Student payload contains question text and options, but strictly omits `correct_option` and `explanation`.
- [x] Authoritative countdown ticks down based on server epoch deadline.

### 5. Risk Allocation & Position Execution
- [x] Student selects an option (A, B, C, or D) and sets risk percentage (e.g. 25%).
- [x] Client renders live potential profit and loss calculation.
- [x] Student clicks `CONFIRM POSITION`.
- [x] Backend records answer in `answers` and locked bid in `positions`.
- [x] UI immediately locks with overlay showing selected option and committed capital.
- [x] Double-click or rapid submission does not create duplicate bids (enforced by DB unique index).

### 6. Market Close, Answer Reveal & Settlement
- [x] Host clicks `🔒 CLOSE MARKET`. Round status updates to `market_closed`. No further bids accepted.
- [x] Host clicks `👁 REVEAL ANSWER`. Solution and explanation are delivered to students.
- [x] Host clicks `⚡ SETTLE ROUND & COMPUTE P/L`.
- [x] Backend calculates winning and losing positions, credits/debits balances, and writes ledger entries to `transactions`.
- [x] Students receive individual settlement breakdown (+Profit or -Loss, updated capital balance).
- [x] Leaderboard updates dynamically with multi-factor ranking.

### 7. Game Completion & Clean Deletion
- [x] Host can advance through all assigned rounds until the final round is settled.
- [x] Host clicks `🏁 COMPLETE COMPETITION`. Game status transitions to `completed`.
- [x] Final Championship Podium displays top 3 traders (Gold, Silver, Bronze) with badges and return %.
- [x] Safe deletion of draft/finished games removes associated rows without leaving orphan data.

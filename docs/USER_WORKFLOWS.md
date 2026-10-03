# Market Master — User Workflows

## 1. Player / Trader Lifecycle Workflow

```
[Student Opens App]
       ↓
[Login / Signup Screen] ──(Valid Credentials)──> [Authenticated Profile Loaded]
       ↓
[Game Lobby / Enter Arena Screen]
       ↓ (Enters 6-character Game PIN e.g. "HF99F3")
[POST /api/game/join]
       ↓
[Waiting Room State] <──(Polls /api/game/current every 1.5s)
       │
       │ Host Publishes Question (Round N)
       ↓
[Active Round Screen]
       ├─ Question & 4 Multiple Choice Options displayed
       ├─ Authoritative Countdown Timer ticking to server deadline
       ├─ Student selects Option (A, B, C, or D)
       ├─ Student adjusts Risk % Slider (e.g. 25%)
       ├─ Live Potential Profit / Loss preview updates
       ↓
[Clicks "CONFIRM POSITION"] ──(POST /api/game/submit)──> [Database Locks Answer & Position]
       ↓
[Position Locked State]
       ├─ Overlay shows chosen option and locked capital at risk
       ├─ Awaiting Market Close
       ↓
[Market Closed by Host / Timer Expires]
       ↓
[Answer Revealed by Host] ──> [Solution & Detailed Explanation Displayed]
       ↓
[Settlement by Host] ──> [Result Card: +$Profit or -$Loss, Updated Capital, Score]
       ↓
[Next Round Published / Game Over]
       ├─ If Next Round: Transition back to [Active Round Screen]
       └─ If Final Round: Transition to [Championship Podium & Game Summary]
```

### State-by-State Behavior & Resiliency for Player

| State | UI Component | Active Polling | Allowed Actions | Refresh Recovery Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Not Joined** | `<JoinGame />` | None | Enter PIN, select avatar, join game | Clean form state; pre-fills profile name |
| **Waiting** | `<GameArena />` | Every 1.5s | View lobby, leave game | Resumes waiting; reconnects immediately |
| **Question Open** | `<GameArena />` | Every 1.5s | Select option, set risk, submit | Restores active question and deadline |
| **Position Locked**| `<GameArena />` | Every 1.5s | View locked submission | Restores locked position and option |
| **Market Closed** | `<GameArena />` | Every 1.5s | Wait for reveal | Shows "Market Closed — Awaiting Reveal" |
| **Result / Settled**| `<GameArena />` | Every 1.5s | View P/L breakdown, continue | Restores settlement summary |
| **Game Over** | `<GameArena />` | None | View final stats, return to lobby | Shows final capital, return %, and badge |

---

## 2. Host / Admin Workflow

```
[Admin Logs In] ──> [Admin Panel (9 Persistent Tabs)]
       │
       ├─ Tab 1: [Question Bank]
       │    ├─ Create questions (Text, 4 Options, Correct Key, Duration, Category)
       │    └─ Audit existing questions
       │
       ├─ Tab 2: [Games Management]
       │    ├─ Create game instance with PIN, capital, risk parameters
       │    ├─ Assign ordered questions (Round 1 to N)
       │    └─ Click "⚡ Open in Market Desk"
       │
       └─ Tab 3: [Market Desk — Live Command Center]
            ├─ Phase 1: Game in Waiting state (watches student join count)
            ├─ Phase 2: Click "📢 PUBLISH QUESTION 1 (SEND TO STUDENTS)"
            │    └─ Round status → question_open
            ├─ Phase 3: Monitor Live Order Book & Sentiment Breakdown
            │    └─ See % capital committed to A, B, C, D
            ├─ Phase 4: Click "🔒 CLOSE MARKET (LOCK BIDS)"
            │    └─ Round status → market_closed
            ├─ Phase 5: Click "👁 REVEAL ANSWER"
            │    └─ Correct answer and explanation revealed to students
            ├─ Phase 6: Click "⚡ SETTLE ROUND & COMPUTE P/L"
            │    └─ Atomic balance settlement, transaction ledger logged
            ├─ Phase 7: Advance to Next Question (Repeat 2–6)
            └─ Phase 8: Click "🏁 COMPLETE COMPETITION"
```

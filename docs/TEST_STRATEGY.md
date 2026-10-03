# Market Master — Comprehensive Test Strategy

## 1. Testing Pyramid & Layers

```
        ┌─────────────────────────┐
        │   E2E Simulation Tests  │ (140 Concurrent Live Students)
        ├─────────────────────────┤
        │    API Regression Tests │ (Admin Control Deck E2E)
        ├─────────────────────────┤
        │   Service & Domain Unit │ (Game Engine, P/L Math, Tie-Break)
        ├─────────────────────────┤
        │ TypeScript / Build Lint │ (tsc --noEmit, Vite Build)
        └─────────────────────────┘
```

---

## 2. Test Suites Inventory

### Suite 1: Full Production Hardening & Concurrency Test
- **File**: `test_full_production_hardening.py`
- **Scope**:
  1. Admin authentication & Question Bank persistence.
  2. Sequential question creation with UUID verification.
  3. Game creation with PIN and assigned questions.
  4. Concurrent provisioning and authentication of 140 student accounts.
  5. Simultaneous joining of 140 students to the same PIN.
  6. Admin starts game (Round 1 live).
  7. Concurrent browser refresh & session auto-recovery spike across all 140 students.
  8. Concurrent answer & risk submission spike across 140 threads.
  9. Admin closes market and reveals answer.
  10. Settlement verification: 70 winners receive exact $+40\%$, 70 losers receive exact $-20\%$.
  11. Financial transaction ledger reconciliation (exactly 280 ledger records).
  12. Safe game deletion & admin audit log verification.
  13. Complete automated database cleanup.
- **Pass Standard**: **33 PASSED, 0 FAILED**.

### Suite 2: Admin Control Deck Regression Suite
- **File**: `test_admin_deck_regression.py`
- **Scope**:
  1. Question Bank CRUD & multi-tab navigation persistence.
  2. Question assignment and game creation without "Question not found" errors.
  3. Market Desk round indicator verification (`ROUND 01 / 01`, NOT `01 / 00`).
  4. One-by-one round lifecycle verification (`start` -> `close_market` -> `reveal` -> `settle` -> `end`).
  5. Answer secrecy audit: player payload strictly excludes `correct_option`.
  6. Zero residual test records left in Supabase.
- **Pass Standard**: **31 PASSED, 0 FAILED**.

### Suite 3: Frontend TypeScript & Static Verification
- **Command**: `npm run build` (`tsc --noEmit && vite build`)
- **Scope**: Full TypeScript compile verification across all 90 modules; ensures zero type discrepancies between React DTOs and backend JSON payloads.
- **Pass Standard**: **0 errors, build time < 1000ms**.

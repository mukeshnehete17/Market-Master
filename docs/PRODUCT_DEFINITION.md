# Market Master — Product Definition

## 1. Product Overview
- **Product Name**: Market Master
- **Product Category**: Live Financial-Market-Style Educational Simulation & Competitive Quiz Platform
- **Primary Purpose**: To teach trading psychology, probabilistic reasoning, and risk management through a fast-paced, synchronized multiplayer simulation where students invest virtual capital against conceptual questions under live market dynamics.
- **Single Source of Truth**: Supabase PostgreSQL database accessed strictly via authenticated Flask API endpoints.
- **Client Interfaces**:
  1. **Student Arena (Web / Mobile Responsive)**: Fast, distraction-free execution interface for joining live market games via PIN, reviewing financial-intel questions, executing risk allocations against virtual capital, viewing settlements, and tracking rank.
  2. **Admin Control Deck (Command Center)**: Dense, high-signal market-command interface for orchestrating question repositories, configuring game parameters, dispatching live rounds one-by-one, monitoring real-time sentiment/order flows, revealing solutions, settling P/L, and analyzing player performance.

---

## 2. Core Concept & Mechanics
1. **Synchronized Multiplayer Arena**:
   - The competition is organized into structured sequential rounds managed by a live host (Admin).
   - Students join using an authenticated trader profile and enter a specific 6-character alphanumeric Game PIN.
2. **Capital & Position Allocation**:
   - Each trader starts with an initial virtual balance (default: $10,000).
   - For each round, students read a high-conviction financial, economic, or market intelligence question with 4 multiple-choice options (A, B, C, D).
   - Students determine their position conviction by selecting an allocation percentage (e.g. 10% to 75% of current available capital) as their market bid.
3. **Execution & Market Settlement**:
   - Bids lock when submitted or when the authoritative host closes the market.
   - Host reveals the correct answer and executes the settlement algorithm.
   - **Correct Answer**: Trader gains $Potential Profit = Bid \times Multiplier$ (e.g., $+100\%$).
   - **Incorrect Answer**: Trader suffers $Potential Loss = Bid \times Multiplier$ (e.g., $-100\%$).
   - **Timeout (No Bid / Answer)**: Trader is assessed a timeout penalty or receives zero return based on game rules.
4. **Dynamic Competition Leaderboard**:
   - Multi-factor ranking: Current Capital $\downarrow$, Score $\downarrow$, Net P/L $\downarrow$, Win Rate % $\downarrow$.
   - Live badge awards (`👑 Market Leader`, `🏆 Top Trader`, `🎯 High Accuracy`, `📈 In The Green`, `📉 Drawdown`).

---

## 3. Product MVP Boundaries
### Must-Have for MVP (Targeted Scope)
- Secure authentication (email/password signup, login, session cookies + Bearer token fallback).
- Role-based authorization (`admin` vs `participant`).
- Question Bank CRUD (create, view, edit, archive, delete questions with category and duration).
- Game Creation & Configuration (assign ordered questions, starting capital, risk parameters, unique PIN).
- One-by-one manual question dispatch controlled strictly by the admin.
- Real-time trader synchronization (polling with jitter and server deadline enforcement).
- Atomic financial ledger & balance calculations in PostgreSQL.
- Multi-factor leaderboard and Top 3 podium standings.
- Admin order book, sentiment breakdown (A/B/C/D capital allocation), and audit logs.
- Automatic session recovery upon page refresh for both admin and students.

### Non-MVP (Post-MVP Roadmap)
- Automated algorithmic market-maker bots.
- Short-selling with margin borrowing or leverage > 1x.
- WebSockets / WebRTC peer-to-peer streaming (standardized JSON polling satisfies MVP latency requirements for ~140 concurrent users).
- Multi-tenant enterprise school districts.

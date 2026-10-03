# Market Master — Frontend Architecture

## 1. Core Framework & Philosophy
- **Stack**: React 19 + TypeScript + Vite.
- **Styling**: Vanilla CSS (`styles.css`, glassmorphism, responsive CSS variables, dark command deck elements, black active action buttons).
- **Zero-Flicker Multi-Tab Memory Model**:
  - The Admin Control Deck mounts all 9 tabs (`deck`, `dashboard`, `students`, `questions`, `games`, `investments`, `leaderboard`, `audit`, `settings`) in persistent DOM containers toggled by `style={{ display: section === id ? 'block' : 'none' }}`.
  - This eliminates destructive unmounting, avoids full-page loading spinners when switching tabs, and makes tab navigation instantaneous (0ms).
- **Session Persistence**:
  - `sessionStorage` caches `mm_admin_selected_game_id` and `mm_admin_section`.
  - `localStorage` stores `mm_auth_token` and `mm_user`.

---

## 2. Directory Structure

```
frontend-ui/FrontEnd/apps/web/
├── index.html                  # HTML entrypoint
├── package.json                # Dependencies and scripts
├── vite.config.ts              # Vite configuration
├── src/
│   ├── main.tsx                # React root mount
│   ├── App.tsx                 # Root layout, auth state machine, tab router
│   ├── styles.css              # Universal design system & dark terminal styling
│   ├── api/                    # Typed API client services
│   │   ├── client.ts           # Centralized fetch wrapper, base URL, error interceptor
│   │   ├── auth.ts             # Authentication API
│   │   ├── game.ts             # Player game API
│   │   ├── admin.ts            # Admin Control Deck API
│   │   ├── player.ts           # Player profile & history API
│   │   └── leaderboard.ts      # Public rankings API
│   ├── types/
│   │   └── api.ts              # TypeScript interfaces & DTOs
│   ├── hooks/
│   │   └── use-reduced-motion.ts
│   └── components/
│       ├── Login.tsx           # Signup & Login credentials form
│       ├── JoinGame.tsx        # PIN entry & avatar selection lobby
│       ├── GameArena.tsx       # Live synchronized question, risk & settlement UI
│       ├── Leaderboard.tsx     # Competition rankings with Top 3 Podium
│       ├── History.tsx         # Transaction log & trade ledger
│       ├── Profile.tsx         # User profile details & logout
│       ├── BottomNav.tsx       # Mobile/desktop responsive navigation
│       ├── GradientBlurBg.tsx  # Dynamic background shader
│       ├── Confetti.tsx        # Victory particle animation
│       ├── ui/                 # Reusable micro-components
│       └── admin/
│           └── AdminPanel.tsx  # Unified 9-section Admin Control Deck
```

---

## 3. Real-Time Polling & Timer Architecture
- **Jittered Polling**:
  - When in an active round or waiting room, `<GameArena />` polls `GET /api/game/current` every 1,500ms.
  - To prevent thundering-herd spikes from 140+ concurrent students, polling interval applies small random jitter ($\pm 200\text{ms}$).
- **Server-Authoritative Countdown**:
  - Timers NEVER rely on client machine system clocks.
  - The backend returns `deadline` (server epoch in seconds) and `time_remaining`.
  - The client calculates remaining seconds as $\max(0, \lfloor \text{deadline} - (\text{Date.now()} / 1000) \rfloor)$.
  - If the timer hits zero, the client locks the bid and polls for market closure.

# Market Master

Market Master is an interactive financial simulation web application built with React, Vite, and TypeScript.

## Features

- **Apple Dynamic Island Header**: Centered, responsive Dynamic Island with integrated Illuminate ID & password authentication, real-time capital display (`Starting Capital: ₹1,000 · 1x / 2x / 3x Risk`), and hardware-accelerated animations.
- **Illuminate OS Authentication Gate**: Simulation access is locked until the trader authenticates in the Dynamic Island.
- **15-Second Decision Deadline**: Strict countdown timer per question with visual urgency indicator and automatic settlement.
- **Risk Multipliers & Liquid Glass**: Choose between No Risk, 1x, 2x, and 3x risk tiers rendered with Apple frosted liquid glass styling and interactive specular glint.
- **21st.dev Gradient Blur Background**: Ambient soft lavender/periwinkle gradient glow with crisp grid pattern overlay.
- **Outcome Celebration**: Real-time portfolio P&L tracking with victory confetti explosions.

## Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Vanilla CSS with Apple SF Pro typography & hardware-accelerated transitions
- **Shaders / Effects**: `@paper-design/shaders` WebGL Liquid Metal button & custom Canvas particle system

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+ (`npm install -g pnpm`)

### Installation & Run

```bash
# Install dependencies
pnpm install

# Start Vite dev server
pnpm dev
```

Open `http://localhost:5173` to play the simulation.

### Build & Checks

```bash
# Typecheck & lint
pnpm check

# Build production bundle
pnpm build
```

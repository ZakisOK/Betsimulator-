# CLAUDE.md — Baccarat Strategy Dashboard

## Project Overview

A browser-based Baccarat betting strategy research tool with a backtesting engine and optional Claude AI math agent. Mathematical research only — no gambling product.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, Zustand
- **Backend:** Node.js + Express (`server.js`) — API proxy for Claude on port 3001
- **No database** — all state is in-memory / localStorage

## Commands

```bash
npm install          # install deps
npm run dev          # frontend on http://localhost:5173
node server.js       # Claude API proxy on port 3001 (optional)
npm run build        # production build
npm run deploy       # build + deploy to gh-pages
```

## Architecture

- Pure frontend simulation engine — 1000+ shoes/second in-browser TypeScript
- `server.js` is a thin Express proxy that keeps `ANTHROPIC_API_KEY` server-side
- No backend persistence — strategies saved to localStorage / exported as JSON
- Statistically correct 8/6-deck Baccarat (Banker 45.86%, Player 44.62%, Tie 9.52%)

## Key Directories

```
src/
  components/   # React UI components
  hooks/        # Custom React hooks
  store/        # Zustand state stores
```

## Environment Variables

```
ANTHROPIC_API_KEY=   # Optional — enables Claude AI math agent (server.js)
PORT=3001            # API proxy port (default 3001)
```

## Code Style

- TypeScript strict mode, no `any`
- Tailwind for all styling — no inline styles
- Zustand for global state, local state for component-only concerns
- Recharts for all charts

## Important Rules

- Never claim any strategy eliminates the house edge — this is a research tool
- Banker EV = −1.06%, Player EV = −1.24%, Tie EV = −14.36% — these are fixed facts
- Keep simulation engine pure TypeScript (no DOM dependencies) for testability


# Code Quality Instructions

- Comments explain WHY, never WHAT. Never restate what the next line does.
- Use concise domain-specific names. Never: userDataResponseObject, handleButtonClickEvent.
- Business-context error messages. Never "An error occurred." Always specific: "Failed to sync portfolio — XRPL node unreachable."
- Vary code structure naturally. Avoid template-pattern repetition.
- Every public function needs a type signature. No any.
- Delete dead code. Never comment it out.

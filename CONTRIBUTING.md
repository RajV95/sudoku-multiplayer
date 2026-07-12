# Codebase Tour & Contribution Guide

Welcome to the **Sudoku Multiplayer Speedrun** project! This guide is designed to help new developers understand the architecture, codebase file structure, and development guidelines.

---

## 1. System Architecture

The application is built on a decoupled architecture containing the following components:

```
 ┌────────────────────────────────────────────────────────┐
 │                      Next.js Client                    │
 └─────────────┬───────────────────────────▲──────────────┘
               │ HTTP Requests             │ WebSockets
               ▼                           ▼
 ┌────────────────────────────────────────────────────────┐
 │                Custom Node.js Server (server.js)       │
 ├─────────────────────────────┬──────────────────────────┤
 │ Next.js API Handlers        │ Socket.IO Handlers       │
 └─────────────┬───────────────┴───────────┬──────────────┘
               ▼                           ▼
 ┌───────────────────────────┐       ┌────────────────────┐
 │       MongoDB Atlas       │       │   Serverless Redis │
 ├───────────────────────────┤       ├────────────────────┤
 │ Accounts, Credentials,    │       │ Active lobby, board│
 │ Match History statistics  │       │ states & timers    │
 └───────────────────────────┘       └────────────────────┘
```

- **HTTP APIs**: Handled by Next.js Route Handlers (authentication, profile stats).
- **Real-Time Game Loop**: Handled by custom Socket.IO event listeners.
- **Cache (Redis)**: Holds temporary session, player connections, and room states (allowing fast, low-latency lookups).
- **Persistent DB (MongoDB)**: Stores persistent user credentials, game history log entries, and profiles.

---

## 2. Directory Structure Tour

Here is a breakdown of the key files in the repository:

### Core Launcher
- **`server.js`**: Custom Node.js server launcher. Mounts Next.js, spins up the HTTP server, registers `ts-node` (enabling TypeScript execution at runtime in production), and initiates Socket.IO listeners.

### Socket Backend
- **`src/socket/socketHandler.ts`**: The core multiplayer logic. Handles room creations, player matchmaking, real-time board updates, chat message relays, mistake trackers, session kicks, and disconnection grace period countdown timers.

### Sudoku Engine
- **`src/lib/generator/dynamic.ts`**: Backtracking solver. Handles puzzle generation for varying difficulties (`easy`, `medium`, `hard`, `expert`).
- **`src/lib/generator/helpers.ts`**: Helper validators. Evaluates cell changes and calculates players' completion progress (0% to 100%).

### Database Connectors & Models
- **`src/lib/db.ts`**: Cached MongoDB mongoose singleton client.
- **`src/lib/redis.ts`**: Cached Redis singleton client equipped with secure TLS socket support for serverless hosts (like Upstash).
- **`src/models/User.ts`**: Mongoose model storing usernames, password hashes, and solved game statistics.
- **`src/models/Match.ts`**: Mongoose model logging finished match history outcomes.

### Frontend App (Next.js App Router)
- **`src/app/page.tsx`**: Login page.
- **`src/app/register/page.tsx`**: Account registration page.
- **`src/app/lobby/page.tsx`**: Game dashboard. Contains room setup controls, difficulty selectors, personal stats, and developer footer links.
- **`src/app/room/[code]/page.tsx`**: Competitive game screen. Displays the 9x9 Sudoku board with real-time matching-value highlights, mistakes trackers, elapsed clock timers, 3x3 numeric keypad (desktop), horizontal keypad row (mobile), opponent trackers, and chat widget.
- **`src/app/globals.css`**: Global stylesheet. Implements responsive CSS columns, Chess.com styling parameters, keyframe animations, and mobile resolutions overrides.

---

## 3. Contribution Workflow

When preparing to write code or submit pull requests:

### Run the Dev Environment
Ensure your local databases are active:
```bash
docker compose up -d
npm run dev
```

### Run the Test Suite
Always run the Vitest suite to verify you haven't introduced regressions:
```bash
npm run test
```

### Validate Production Compilation
Before pushing code, run a local production build to check for strict TypeScript type errors:
```bash
npm run build
```

---

## 4. Coding Guidelines

1. **Keep Singletons Cached**: When modifying database helpers, preserve the global connection caching pattern to prevent socket leaks during Next.js hot reloads.
2. **Environment Independent Hostnames**: Do not hardcode hostnames. Use `process.env.HOSTNAME` or conditional fallbacks to toggle between `localhost` (dev) and `0.0.0.0` (prod).
3. **Type Annotation Consistency**: Set explicit types on caching bindings and third-party modules to pass compilation steps.

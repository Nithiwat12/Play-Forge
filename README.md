# Board Game Platform

A scalable, modular multiplayer board game platform. The core (auth, users,
rooms, lobbies, sockets, game sessions, history) is completely game-agnostic;
**Spy Hunt** (a Spyfall-style social deduction game, internal code name
`spyfall`) is the first game built on top of it, and future games plug in
without touching the platform code.

```
Game Platform
|
|-- Auth System        (JWT + bcrypt)
|-- User System
|-- Game Library        (data-driven from the `games` table)
|-- Room System          (create/join/leave, room codes, passwords)
|-- Lobby System          (real-time via Socket.IO)
|-- Socket System
|
|-- Game Manager   -----+
|-- Game Registry        |--> SpyfallGame (BaseGame implementation)
|                        `--> FutureGame, FutureGame, ...
|-- Game Session System
|-- Game History System
```

## Tech stack

- **Frontend:** React + Vite + TypeScript, Tailwind CSS, Zustand, React Router, Socket.IO client
- **Backend:** Node.js + Express + TypeScript, Socket.IO, JWT, bcrypt
- **Database:** PostgreSQL + Prisma ORM

## Project layout

```
server/
  prisma/schema.prisma      Prisma models (User, Game, Room, RoomPlayer, GameSession, GameHistory)
  prisma/seed.ts            Seeds the Spy Hunt game into the Game Library
  src/
    config/                 env, prisma client
    middleware/              authMiddleware, errorMiddleware
    controllers/, routes/, services/   REST API (auth, games, rooms, users)
    socket/                  Socket.IO auth + generic room/game event handlers
    games/
      core/                  BaseGame, GameRegistry, GameManager - the reusable engine contract
      spyfall/                SpyfallGame, rules, locations, roles - Spyfall-only code
      registerGames.ts        registers every implemented game

client/
  src/
    pages/                   Login, Register, Home, GamePage, CreateRoom, JoinRoom, Lobby, PlayPage, HistoryPage, GameResult
    games/
      registry.tsx            slug -> React component map (client-side GameRegistry)
      spyfall/                 SpyfallGame UI, RoleCard, Timer, Voting, PlayerList
    components/               common/ room/ game/ reusable UI
    stores/                    authStore, roomStore, gameStore (Zustand)
    services/                  api.ts (REST + JWT), socket.ts (Socket.IO client)
```

## Adding a future game

1. Implement `BaseGame` in `server/src/games/<new-game>/`.
2. Register it: `GameRegistry.register("new-game", (roomId) => new NewGame(roomId))` (see `server/src/games/spyfall/index.ts` for the pattern), and import that module from `server/src/games/registerGames.ts`.
3. Insert a row into the `games` table (or extend `prisma/seed.ts`) with the matching `slug`.
4. Add a client component and register it in `client/src/games/registry.tsx`.

Nothing in auth, users, rooms, lobby, or the socket layer needs to change.

## Prerequisites

- Node.js 18+ (Node 20/22 recommended)
- PostgreSQL 14+ running locally (or a connection string to a hosted instance)

## Setup

### 1. Install dependencies

```bash
npm run install:all
# or manually:
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Edit `server/.env` and set `DATABASE_URL` to your Postgres connection string,
and set `JWT_SECRET` to a long random string. The defaults in `client/.env`
(`http://localhost:4000`) work as-is for local development.

### 3. Create the database and run migrations

Make sure Postgres is running, then from `server/`:

```bash
cd server
npx prisma migrate dev --name init
npm run seed        # inserts the Spy Hunt row into the Game Library
```

### 4. Run the app (two terminals)

```bash
# Terminal 1
cd server
npm run dev          # http://localhost:4000

# Terminal 2
cd client
npm run dev           # http://localhost:5173
```

Open `http://localhost:5173`, register an account, and you'll land on the
Game Library with Spy Hunt ready to play. Open a second browser (or a private
window) and register a second account to test real multiplayer - Spy Hunt
needs at least 3 players to start.

### Useful Prisma commands

```bash
npx prisma studio          # visual DB browser
npx prisma migrate dev     # create/apply a new migration in development
npx prisma migrate deploy  # apply migrations in production
```

## How Spy Hunt works here

- The host creates a room (name, max players, optional password) and shares
  the generated room code.
- Players join via the code (and password, if set) and wait in a real-time
  lobby (Socket.IO) showing who's connected, ready, and who's the host.
- The host starts the game once there are at least 3 players. The server
  picks a random location and a random Spy, deals roles to everyone else,
  and starts an 8-minute timer.
- Each player receives **only their own** private role/location over their
  own socket - normal players see their location + role, the Spy only sees
  "You are the Spy". Nothing about other players' roles is ever broadcast.
- Players ask/answer questions (logged for everyone to see) and can vote out
  who they think the Spy is at any time; once everyone has voted, the game
  resolves. The Spy can instead guess the location directly to win/lose
  immediately. If time runs out, whatever votes exist are tallied - a Spy
  who avoids suspicion (or a tie) wins by default.
- Every finished round is written to `GameSession` + `GameHistory` and shows
  up under **History** for every player who took part.

## Security notes

- Passwords (user accounts and room passwords) are hashed with bcrypt - never
  stored or transmitted in plaintext, and room password hashes are never sent
  to clients (`hasPassword: true/false` only).
- REST routes that require a logged-in user run through `authMiddleware`,
  which verifies the JWT.
- Every Socket.IO connection is authenticated with the same JWT before any
  event handler runs (`server/src/socket/socketAuth.ts`) - there are no
  anonymous sockets.
- All room/game actions are re-validated server-side (room capacity, host
  permissions, game status, turn-legal actions) regardless of what the
  client sends - the server is the single source of truth for game state.

## What's not included (by design, per the "future-ready" scope)

- Redis (for horizontal scaling of Socket.IO / shared game state across
  multiple server processes) and Docker are intentionally left out of this
  first build, as noted in the spec - `GameManager`'s interface was written
  so swapping its in-memory `Map` for Redis later wouldn't change any
  callers.

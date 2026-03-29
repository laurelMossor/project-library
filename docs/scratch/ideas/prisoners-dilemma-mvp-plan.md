# Prisoner's Dilemma: Drop-In Arena — MVP Tech Plan

## Concept

A persistent lobby where human players drop in and play iterated Prisoner's Dilemma rounds against each other and always-on bot opponents. Each player/bot has a visible history widget (green/red dot trail), total score, and average score.

---

## Stack

- **Framework:** Next.js 14+ (App Router) with TypeScript
- **Real-time:** Polling via Route Handlers (no WebSockets)
- **State:** In-memory for dev; Vercel KV (Redis) for production
- **Styling:** Tailwind
- **Deployment:** Vercel

### Why polling over WebSockets

The core game loop is turn-based: submit a move, wait for your opponent, see the result. There's no moment where both players need sub-second reactivity. A 1-2s poll interval feels instant for this kind of interaction and eliminates the entire category of WebSocket connection management, reconnection logic, and deployment constraints.

---

## Data Model

```typescript
// --- Core types ---

type Move = "cooperate" | "defect";

type Player = {
  id: string;            // generated on first visit, stored in cookie
  name: string;
  type: "human" | "bot";
  strategy?: BotStrategy;
  displayDots: Move[];   // last 30 moves (the widget)
  totalScore: number;
  matchCount: number;    // total rounds played
  status: "idle" | "queued" | "in_match";
  currentMatchId: string | null;
  lastSeen: number;      // unix ms — for pruning disconnected humans
};

type BotStrategy =
  | "always_cooperate"
  | "always_defect"
  | "tit_for_tat"
  | "suspicious_tit_for_tat"
  | "tit_for_two_tats"
  | "grim_trigger"
  | "pavlov"
  | "generous_tit_for_tat"
  | "random"
  | "prober";

type Match = {
  id: string;
  playerA: string;
  playerB: string;
  round: number;              // current round (1-indexed)
  maxRounds: number;          // hidden from clients
  moveA: Move | null;         // null = hasn't moved yet
  moveB: Move | null;
  resolved: boolean;          // true once both moves scored
  roundResult: {
    a: { move: Move; score: number };
    b: { move: Move; score: number };
  } | null;
  history: { a: Move; b: Move }[];
  status: "active" | "complete";
  roundDeadline: number;      // unix ms — auto-defect after this
};
```

---

## Payoff Matrix

```
                  Opponent
                  C         D
  You   C       3, 3      0, 5
        D       5, 0      1, 1
```

```typescript
const PAYOFF = {
  MUTUAL_COOPERATE: 3,
  MUTUAL_DEFECT: 1,
  BETRAYER: 5,
  SUCKER: 0,
} as const;

function score(you: Move, them: Move): [number, number] {
  if (you === "cooperate" && them === "cooperate") return [3, 3];
  if (you === "defect" && them === "defect") return [1, 1];
  if (you === "defect") return [5, 0];
  return [0, 5];
}
```

---

## Bot Strategy Implementations

Each bot is a pure function: `(myHistory, opponentHistory) => Move`

```typescript
type StrategyFn = (myMoves: Move[], theirMoves: Move[]) => Move;

const strategies: Record<BotStrategy, StrategyFn> = {

  always_cooperate: () => "cooperate",

  always_defect: () => "defect",

  random: () => (Math.random() > 0.5 ? "cooperate" : "defect"),

  tit_for_tat: (_my, theirs) =>
    theirs.length === 0 ? "cooperate" : theirs[theirs.length - 1],

  suspicious_tit_for_tat: (_my, theirs) =>
    theirs.length === 0 ? "defect" : theirs[theirs.length - 1],

  tit_for_two_tats: (_my, theirs) => {
    if (theirs.length < 2) return "cooperate";
    return theirs.slice(-2).every((m) => m === "defect")
      ? "defect"
      : "cooperate";
  },

  grim_trigger: (_my, theirs) =>
    theirs.includes("defect") ? "defect" : "cooperate",

  pavlov: (my, theirs) => {
    if (theirs.length === 0) return "cooperate";
    const lastMine = my[my.length - 1];
    const lastTheirs = theirs[theirs.length - 1];
    const won =
      (lastMine === "cooperate" && lastTheirs === "cooperate") ||
      (lastMine === "defect" && lastTheirs === "cooperate");
    return won ? lastMine : lastMine === "cooperate" ? "defect" : "cooperate";
  },

  generous_tit_for_tat: (_my, theirs) => {
    if (theirs.length === 0) return "cooperate";
    if (theirs[theirs.length - 1] === "cooperate") return "cooperate";
    return Math.random() < 0.1 ? "cooperate" : "defect";
  },

  prober: (my, theirs) => {
    if (my.length === 0) return "cooperate";
    if (my.length === 1) return "defect";
    if (my.length === 2) return "cooperate";
    if (theirs[2] === "cooperate") return "defect";
    return theirs[theirs.length - 1];
  },
};
```

Bots can run concurrent matches — they're stateless functions that derive their move from the match history each time.

---

## API Routes

All routes under `/app/api/`. Clients only ever see their own perspective.

### `POST /api/join`

Register a player. Returns player ID.

```typescript
// Request:  { name: string }
// Response: { playerId: string, lobby: PlayerSummary[] }
```

### `GET /api/lobby`

Polled every 3-5s. Returns all players with their widgets.

```typescript
// Response: { players: PlayerSummary[] }

type PlayerSummary = {
  id: string;
  name: string;
  type: "human" | "bot";
  strategy?: string;
  displayDots: Move[];
  totalScore: number;
  avgScore: number;
  status: "idle" | "queued" | "in_match";
};
```

### `POST /api/queue`

Player requests a match. Server checks for another queued human; if none, pairs with a random bot.

```typescript
// Request:  { playerId: string }
// Response: { matchId: string, opponent: PlayerSummary }
```

### `POST /api/move`

Submit a move. If opponent is a bot, the bot moves immediately and the round resolves in the same response. If opponent is human, move is stored and response says waiting.

```typescript
// Request:  { playerId: string, matchId: string, move: Move }
// Response: { status: "waiting" } | { status: "resolved", result: RoundResult }

type RoundResult = {
  round: number;
  yourMove: Move;
  theirMove: Move;
  yourScore: number;
  theirScore: number;
  matchOver: boolean;
  matchSummary?: {
    totalRounds: number;
    yourTotal: number;
    theirTotal: number;
  };
};
```

### `GET /api/match/[matchId]`

Polled every 1-2s while waiting for opponent's move.

```typescript
// Query: ?playerId=xxx
// Response:
{
  round: number;
  yourMoveSubmitted: boolean;
  opponentMoveSubmitted: boolean;
  resolved: boolean;
  result?: RoundResult;
  secondsRemaining: number;
}
```

### `POST /api/leave`

Player leaves. Forfeits current match if active.

---

## Match Flow

```
1. Human hits POST /api/queue
2. Server checks queue:
   a. Another human waiting → pair them, create Match
   b. No human → pick random bot, create Match
3. Both get matchId + opponent info

4. Round loop:
   a. Client shows Cooperate / Defect buttons + countdown
   b. Human submits POST /api/move

   c. VS BOT:
      - Bot strategy runs immediately on server
      - Round resolves in same response
      - Client gets result instantly, no polling needed

   d. VS HUMAN:
      - Move stored, response: { status: "waiting" }
      - Client polls GET /api/match/[id] every 1-2s
      - When both moves are in, server resolves the round
      - Next poll returns the result

   e. If 15s pass with no move → auto-defect for that player
      (checked on each poll — server compares roundDeadline)

5. Client shows result for 2s, then opens next round
6. After final round → match status: "complete"
7. Both players' widgets + scores update
8. Players return to lobby
```

### Why bot matches feel different (and that's good)

Against a bot, every round resolves instantly in the `/api/move` response — submit, see result, next round. The pace is fast and rhythmic. Against a human, there's a natural pause while you wait — and that tension is actually part of the experience. You're wondering what they're going to do. The asymmetry isn't a bug.

---

## Match Length

Randomized, hidden from both players:

```typescript
function randomMatchLength(): number {
  return 15 + Math.floor(Math.random() * 11); // 15-25
}
```

Client shows "Round 7" but never "Round 7 of 19." Prevents endgame defection.

---

## History Widget (DotTrail)

Last 30 moves as colored dots, updated after each round.

```
Visual spec:
- Dots: 8px circles, 2px gap, wrapping row
- Cooperate → bg-emerald-400
- Defect → bg-rose-400
- Most recent 5: full opacity, 10px
- Dots 6-15: 70% opacity
- Dots 16-30: 40% opacity
- Left = oldest, right = newest
- Container ~200px wide inside the player card
```

### Player Card Layout

```
┌──────────────────────────┐
│  🤖 Tit for Tat          │
│                          │
│  ●●●●●●●○●●●●●●●●●○●●●  │
│                          │
│  Total: 1,247   Avg: 2.8 │
│  Status: Available       │
└──────────────────────────┘
```

---

## Client State Machine

```
IDLE → QUEUED → IN_MATCH → IDLE
                    │
              ┌─────┴─────┐
              │            │
          CHOOSING     WAITING
         (pick move)  (poll for opponent)
              │            │
              └─────┬──────┘
                 REVEAL
              (show result, 2s)
                    │
             next round or
             match complete
```

Managed by a single `useGame` hook:

```typescript
function useGame(playerId: string) {
  const [phase, setPhase] = useState<
    "idle" | "queued" | "choosing" | "waiting" | "reveal"
  >("idle");
  const [match, setMatch] = useState<MatchState | null>(null);

  // Poll /api/match/[id] at 1-2s when phase === "waiting"
  // Poll /api/lobby at 3-5s when phase === "idle"
}
```

---

## Polling Summary

| What | Endpoint | Interval | Active when |
|---|---|---|---|
| Lobby roster | `GET /api/lobby` | 3-5s | idle or queued |
| Round resolution | `GET /api/match/[id]` | 1-2s | waiting for opponent's move |

Two conditional polling loops. Nothing else.

---

## Timeout Handling

No cron needed. Timeouts are checked lazily:

```typescript
// In GET /api/match/[matchId] handler:
if (!match.resolved && Date.now() > match.roundDeadline) {
  // Auto-defect for whoever hasn't moved
  if (!match.moveA) match.moveA = "defect";
  if (!match.moveB) match.moveB = "defect";
  resolveRound(match);
}
```

The poll itself triggers the timeout check. No background process required.

---

## MVP Scope

### In scope

- Lobby with player/bot roster (polled)
- HTTP-only game loop, no WebSockets
- All 10 bot strategies
- Cooperate / Defect UI with countdown timer
- DotTrail history widget per player
- Total score + average display
- Auto-match with bots when no humans available
- Random hidden match length (15-25 rounds)
- Auto-defect on timeout (15s)
- Responsive layout
- Deployable on Vercel

### Out of scope (fast follows)

- Persistence across deploys (Vercel KV)
- Leaderboard page
- Choose-your-opponent (click a card to challenge)
- Evolutionary tournament mode
- Player-created bot strategies
- Match replay viewer
- Auth (anonymous cookie-based ID is fine for MVP)
- SSE upgrade for lower-latency polling

---

## File Structure

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Lobby + game (single page)
│   ├── globals.css
│   └── api/
│       ├── join/route.ts
│       ├── lobby/route.ts
│       ├── queue/route.ts
│       ├── move/route.ts
│       ├── match/[matchId]/route.ts
│       └── leave/route.ts
├── components/
│   ├── Lobby.tsx
│   ├── PlayerCard.tsx
│   ├── DotTrail.tsx
│   ├── GameBoard.tsx
│   ├── MoveButtons.tsx
│   ├── RoundResult.tsx
│   ├── Timer.tsx
│   └── MatchSummary.tsx
├── hooks/
│   ├── useGame.ts                  # Client state machine
│   └── usePoll.ts                  # Generic polling hook
├── lib/
│   ├── game-state.ts               # In-memory state (swap for KV later)
│   ├── strategies.ts               # Bot pure functions
│   ├── payoff.ts                   # Score calculation
│   ├── match.ts                    # Match creation + resolution
│   └── types.ts                    # Shared types
├── package.json
└── tsconfig.json
```

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "uuid": "^9"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/uuid": "^9"
  }
}
```

Three runtime dependencies.

---

## State: In-Memory → KV Migration Path

For MVP, `lib/game-state.ts` is module-scoped Maps:

```typescript
const players = new Map<string, Player>();
const matches = new Map<string, Match>();
const queue: string[] = [];

export const state = { players, matches, queue };
```

This works in `next dev` (single long-lived process). On Vercel, it mostly works under light load but breaks if multiple serverless instances spin up.

Migration to Vercel KV is mechanical:

1. `npm i @vercel/kv`
2. Replace `Map.get/set` with `kv.get/set` in `game-state.ts`
3. Add TTLs for auto-expiry of stale players/matches
4. API routes don't change at all

---

## Serverless Caveat

Vercel serverless functions don't share memory across instances. The in-memory approach is fine for local dev and light testing with friends. For real traffic, add KV. The abstraction boundary at `lib/game-state.ts` means this is a contained change — nothing else in the codebase touches state directly.

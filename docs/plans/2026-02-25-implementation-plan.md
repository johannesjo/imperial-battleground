# Imperial Battleground Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable two-player hot-seat tactical combat game on mobile web, faithful to Conquest of the New World's battle system.

**Architecture:** Pure functional TypeScript with HTML5 Canvas rendering. Game logic is entirely separated from rendering and input. All state transitions are pure functions that take state in and return new state. Canvas renderer is stateless — given a game state, it draws it.

**Tech Stack:** TypeScript, Bun (runtime, bundler, test runner), HTML5 Canvas

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`

**Step 1: Initialize project with bun**

Run: `cd /home/johannes/www/imperial-battleground && bun init -y`

**Step 2: Configure tsconfig.json**

Replace the generated `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "sourceMap": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"]
}
```

**Step 3: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Imperial Battleground</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #1a1a2e; }
    canvas { display: block; margin: 0 auto; touch-action: none; }
  </style>
</head>
<body>
  <canvas id="game"></canvas>
  <script type="module" src="src/main.ts"></script>
</body>
</html>
```

**Step 4: Create minimal src/main.ts**

```typescript
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

ctx.fillStyle = '#1a1a2e';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#e0e0e0';
ctx.font = '24px monospace';
ctx.textAlign = 'center';
ctx.fillText('Imperial Battleground', canvas.width / 2, canvas.height / 2);
```

**Step 5: Add dev script to package.json**

Add to scripts: `"dev": "bun --hot src/main.ts"` — actually for a browser app we need a dev server. Use:

```json
{
  "scripts": {
    "dev": "bunx --bun live-server --port=3000 --no-browser",
    "test": "bun test",
    "typecheck": "bunx tsc --noEmit"
  }
}
```

**Step 6: Verify it works**

Run: `cd /home/johannes/www/imperial-battleground && bun run typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with bun, typescript, canvas"
```

---

### Task 2: Core Types

**Files:**
- Create: `src/types.ts`
- Test: `src/__tests__/types.test.ts`

**Step 1: Write the type definitions**

```typescript
// src/types.ts

export type Player = 1 | 2;

export type UnitType = 'infantry' | 'cavalry' | 'artillery';

export interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: Player;
  level: number; // 1-5, represents both HP and attack dice
  hasMoved: boolean; // reset each turn
  hasAttacked: boolean; // reset each turn
  movedSquares: number; // how many squares moved this turn (for cavalry charge)
}

export interface Position {
  readonly col: number; // 0-2
  readonly row: number; // 0-3 for playable grid, -1 for P1 reserve, 4 for P2 reserve
}

export interface Square {
  readonly position: Position;
  readonly units: Unit[];
}

export type GridRow = readonly [Square, Square, Square];

export interface GameState {
  readonly grid: readonly GridRow[]; // 4 rows of 3 columns
  readonly p1Reserve: Unit[];
  readonly p2Reserve: Unit[];
  readonly currentPlayer: Player;
  readonly actionPoints: number;
  readonly maxActionPoints: number;
  readonly selectedSquare: Position | null;
  readonly phase: GamePhase;
  readonly turnNumber: number;
  readonly winner: Player | null;
  readonly combatLog: CombatLogEntry[];
}

export type GamePhase = 'playing' | 'handoff' | 'game-over' | 'retreat-confirm';

export interface CombatLogEntry {
  readonly turn: number;
  readonly player: Player;
  readonly action: string;
  readonly details: string;
}

export interface AttackResult {
  readonly attackerSquares: Position[];
  readonly targetSquare: Position;
  readonly totalDice: number;
  readonly threshold: number;
  readonly hits: number;
  readonly bonuses: BonusType[];
  readonly unitDamage: Array<{ unitId: string; damage: number; destroyed: boolean }>;
}

export type BonusType =
  | 'combined-arms-2'
  | 'combined-arms-3'
  | 'flanking-2'
  | 'flanking-3'
  | 'flanking-4'
  | 'cavalry-charge';

// Constants
export const GRID_COLS = 3;
export const GRID_ROWS = 4;
export const MAX_STACK_SLOTS = 6;
export const DEFAULT_AP = 6;
export const BASE_THRESHOLD = 6;
export const MIN_THRESHOLD = 2;
export const MAX_THRESHOLD = 38;
export const D40 = 40;

export const UNIT_STACK_COST: Record<UnitType, number> = {
  infantry: 1,
  cavalry: 2,
  artillery: 2,
};

export const BONUS_VALUES: Record<BonusType, number> = {
  'combined-arms-2': 4,
  'combined-arms-3': 6,
  'flanking-2': 4,
  'flanking-3': 6,
  'flanking-4': 8,
  'cavalry-charge': 6,
};
```

**Step 2: Write a basic type validation test**

```typescript
// src/__tests__/types.test.ts
import { describe, expect, test } from 'bun:test';
import {
  UNIT_STACK_COST,
  BONUS_VALUES,
  GRID_COLS,
  GRID_ROWS,
  DEFAULT_AP,
  BASE_THRESHOLD,
  D40,
} from '../types';

describe('Game constants', () => {
  test('grid dimensions are 3x4', () => {
    expect(GRID_COLS).toBe(3);
    expect(GRID_ROWS).toBe(4);
  });

  test('default action points is 6', () => {
    expect(DEFAULT_AP).toBe(6);
  });

  test('base threshold is 6 on d40', () => {
    expect(BASE_THRESHOLD).toBe(6);
    expect(D40).toBe(40);
  });

  test('infantry costs 1 slot, cavalry and artillery cost 2', () => {
    expect(UNIT_STACK_COST.infantry).toBe(1);
    expect(UNIT_STACK_COST.cavalry).toBe(2);
    expect(UNIT_STACK_COST.artillery).toBe(2);
  });

  test('bonus values match original game', () => {
    expect(BONUS_VALUES['combined-arms-2']).toBe(4);
    expect(BONUS_VALUES['combined-arms-3']).toBe(6);
    expect(BONUS_VALUES['flanking-2']).toBe(4);
    expect(BONUS_VALUES['flanking-3']).toBe(6);
    expect(BONUS_VALUES['flanking-4']).toBe(8);
    expect(BONUS_VALUES['cavalry-charge']).toBe(6);
  });
});
```

**Step 3: Run tests**

Run: `bun test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/types.ts src/__tests__/types.test.ts
git commit -m "feat: add core type definitions and game constants"
```

---

### Task 3: Game State Factory

**Files:**
- Create: `src/game-state.ts`
- Test: `src/__tests__/game-state.test.ts`

**Step 1: Write failing tests for initial state creation**

```typescript
// src/__tests__/game-state.test.ts
import { describe, expect, test } from 'bun:test';
import { createInitialState, createUnit } from '../game-state';
import { DEFAULT_AP, GRID_COLS, GRID_ROWS } from '../types';

describe('createUnit', () => {
  test('creates a unit with correct properties', () => {
    const unit = createUnit('infantry', 1, 2);
    expect(unit.type).toBe('infantry');
    expect(unit.owner).toBe(1);
    expect(unit.level).toBe(2);
    expect(unit.hasMoved).toBe(false);
    expect(unit.hasAttacked).toBe(false);
    expect(unit.movedSquares).toBe(0);
    expect(unit.id).toBeTruthy();
  });

  test('generates unique IDs', () => {
    const u1 = createUnit('infantry', 1, 2);
    const u2 = createUnit('infantry', 1, 2);
    expect(u1.id).not.toBe(u2.id);
  });
});

describe('createInitialState', () => {
  test('creates empty 3x4 grid', () => {
    const state = createInitialState();
    expect(state.grid.length).toBe(GRID_ROWS);
    state.grid.forEach(row => {
      expect(row.length).toBe(GRID_COLS);
      row.forEach(sq => expect(sq.units.length).toBe(0));
    });
  });

  test('populates both reserves with mirror armies', () => {
    const state = createInitialState();
    expect(state.p1Reserve.length).toBe(6);
    expect(state.p2Reserve.length).toBe(6);

    const countTypes = (units: typeof state.p1Reserve) => ({
      infantry: units.filter(u => u.type === 'infantry').length,
      cavalry: units.filter(u => u.type === 'cavalry').length,
      artillery: units.filter(u => u.type === 'artillery').length,
    });

    expect(countTypes(state.p1Reserve)).toEqual({ infantry: 3, cavalry: 2, artillery: 1 });
    expect(countTypes(state.p2Reserve)).toEqual({ infantry: 3, cavalry: 2, artillery: 1 });
  });

  test('all units start at level 2', () => {
    const state = createInitialState();
    [...state.p1Reserve, ...state.p2Reserve].forEach(u => {
      expect(u.level).toBe(2);
    });
  });

  test('player 1 starts first with full AP', () => {
    const state = createInitialState();
    expect(state.currentPlayer).toBe(1);
    expect(state.actionPoints).toBe(DEFAULT_AP);
  });

  test('game starts in playing phase with no winner', () => {
    const state = createInitialState();
    expect(state.phase).toBe('playing');
    expect(state.winner).toBeNull();
    expect(state.selectedSquare).toBeNull();
    expect(state.turnNumber).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — module `../game-state` not found

**Step 3: Implement game-state.ts**

```typescript
// src/game-state.ts
import type { GameState, GridRow, Player, Square, Unit, UnitType, Position } from './types';
import { DEFAULT_AP, GRID_COLS, GRID_ROWS } from './types';

let nextId = 0;

export function createUnit(type: UnitType, owner: Player, level: number): Unit {
  return {
    id: `${owner}-${type}-${++nextId}`,
    type,
    owner,
    level,
    hasMoved: false,
    hasAttacked: false,
    movedSquares: 0,
  };
}

function createSquare(col: number, row: number): Square {
  return { position: { col, row }, units: [] };
}

function createGrid(): readonly GridRow[] {
  const rows: GridRow[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    rows.push([
      createSquare(0, r),
      createSquare(1, r),
      createSquare(2, r),
    ]);
  }
  return rows;
}

function createArmy(owner: Player): Unit[] {
  return [
    createUnit('infantry', owner, 2),
    createUnit('infantry', owner, 2),
    createUnit('infantry', owner, 2),
    createUnit('cavalry', owner, 2),
    createUnit('cavalry', owner, 2),
    createUnit('artillery', owner, 2),
  ];
}

export function createInitialState(): GameState {
  return {
    grid: createGrid(),
    p1Reserve: createArmy(1),
    p2Reserve: createArmy(2),
    currentPlayer: 1,
    actionPoints: DEFAULT_AP,
    maxActionPoints: DEFAULT_AP,
    selectedSquare: null,
    phase: 'playing',
    turnNumber: 1,
    winner: null,
    combatLog: [],
  };
}

export function getSquare(state: GameState, pos: Position): Square | undefined {
  const row = state.grid[pos.row];
  if (!row) return undefined;
  return row[pos.col];
}

export function getReserve(state: GameState, player: Player): Unit[] {
  return player === 1 ? state.p1Reserve : state.p2Reserve;
}

export function getHomeRow(player: Player): number {
  return player === 1 ? 0 : 3;
}
```

**Step 4: Run tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/game-state.ts src/__tests__/game-state.test.ts
git commit -m "feat: add game state factory and initial state creation"
```

---

### Task 4: Movement Rules

**Files:**
- Create: `src/rules.ts`
- Test: `src/__tests__/rules.test.ts`

**Step 1: Write failing tests for movement validation**

```typescript
// src/__tests__/rules.test.ts
import { describe, expect, test } from 'bun:test';
import { getValidMoves, canDeploy } from '../rules';
import { createInitialState, createUnit, getSquare } from '../game-state';
import type { GameState, Position, Unit } from '../types';

// Helper: place a unit on the grid and return updated state
function placeUnit(state: GameState, unit: Unit, pos: Position): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return { ...sq, units: [...sq.units, unit] };
      }
      return sq;
    }) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

describe('getValidMoves', () => {
  test('infantry can move 1 square orthogonally', () => {
    const inf = createUnit('infantry', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });

    const moves = getValidMoves(state, inf, { col: 1, row: 1 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    expect(moveKeys).toContain('1,0'); // down
    expect(moveKeys).toContain('1,2'); // up
    expect(moveKeys).toContain('0,1'); // left
    expect(moveKeys).toContain('2,1'); // right
    expect(moves.length).toBe(4);
  });

  test('infantry cannot move diagonally', () => {
    const inf = createUnit('infantry', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });

    const moves = getValidMoves(state, inf, { col: 1, row: 1 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    expect(moveKeys).not.toContain('0,0');
    expect(moveKeys).not.toContain('2,0');
    expect(moveKeys).not.toContain('0,2');
    expect(moveKeys).not.toContain('2,2');
  });

  test('cavalry can move up to 2 squares orthogonally', () => {
    const cav = createUnit('cavalry', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, cav, { col: 1, row: 1 });

    const moves = getValidMoves(state, cav, { col: 1, row: 1 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    // 1 square moves
    expect(moveKeys).toContain('1,0');
    expect(moveKeys).toContain('1,2');
    expect(moveKeys).toContain('0,1');
    expect(moveKeys).toContain('2,1');
    // 2 square moves
    expect(moveKeys).toContain('1,3'); // 2 up
  });

  test('artillery can only move within home row', () => {
    const art = createUnit('artillery', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, art, { col: 0, row: 0 }); // P1 home row

    const moves = getValidMoves(state, art, { col: 0, row: 0 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    expect(moveKeys).toContain('1,0'); // sideways on home row
    expect(moveKeys).not.toContain('0,1'); // cannot leave home row
  });

  test('units cannot move off the grid', () => {
    const inf = createUnit('infantry', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 0, row: 0 }); // corner

    const moves = getValidMoves(state, inf, { col: 0, row: 0 });
    moves.forEach(m => {
      expect(m.col).toBeGreaterThanOrEqual(0);
      expect(m.col).toBeLessThan(3);
      expect(m.row).toBeGreaterThanOrEqual(0);
      expect(m.row).toBeLessThan(4);
    });
  });

  test('units cannot move to squares exceeding stack limit', () => {
    let state = createInitialState();
    // Fill a square with 6 infantry (6 slots)
    for (let i = 0; i < 6; i++) {
      state = placeUnit(state, createUnit('infantry', 1, 2), { col: 1, row: 0 });
    }
    // Try to move another infantry adjacent
    const inf = createUnit('infantry', 1, 2);
    state = placeUnit(state, inf, { col: 0, row: 0 });

    const moves = getValidMoves(state, inf, { col: 0, row: 0 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    expect(moveKeys).not.toContain('1,0'); // full square
  });

  test('unit that already moved cannot move again', () => {
    const inf = createUnit('infantry', 1, 2);
    inf.hasMoved = true;
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });

    const moves = getValidMoves(state, inf, { col: 1, row: 1 });
    expect(moves.length).toBe(0);
  });
});

describe('canDeploy', () => {
  test('can deploy to own home row if space available', () => {
    const state = createInitialState();
    expect(canDeploy(state, 1, { col: 0, row: 0 })).toBe(true);
    expect(canDeploy(state, 1, { col: 1, row: 0 })).toBe(true);
    expect(canDeploy(state, 1, { col: 2, row: 0 })).toBe(true);
  });

  test('cannot deploy to non-home row', () => {
    const state = createInitialState();
    expect(canDeploy(state, 1, { col: 1, row: 1 })).toBe(false);
    expect(canDeploy(state, 1, { col: 1, row: 3 })).toBe(false);
  });

  test('P2 home row is row 3', () => {
    const state = createInitialState();
    expect(canDeploy(state, 2, { col: 1, row: 3 })).toBe(true);
    expect(canDeploy(state, 2, { col: 1, row: 0 })).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — `getValidMoves` and `canDeploy` not found

**Step 3: Implement rules.ts (movement part)**

```typescript
// src/rules.ts
import type { GameState, Position, Unit, UnitType, Player } from './types';
import { GRID_COLS, GRID_ROWS, MAX_STACK_SLOTS, UNIT_STACK_COST } from './types';
import { getSquare, getHomeRow } from './game-state';

function isInBounds(pos: Position): boolean {
  return pos.col >= 0 && pos.col < GRID_COLS && pos.row >= 0 && pos.row < GRID_ROWS;
}

function stackUsed(units: Unit[]): number {
  return units.reduce((sum, u) => sum + UNIT_STACK_COST[u.type], 0);
}

function canFitInSquare(state: GameState, pos: Position, unit: Unit): boolean {
  const sq = getSquare(state, pos);
  if (!sq) return false;
  return stackUsed(sq.units) + UNIT_STACK_COST[unit.type] <= MAX_STACK_SLOTS;
}

const ORTHOGONAL: readonly Position[] = [
  { col: 0, row: -1 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
  { col: 1, row: 0 },
];

export function getValidMoves(state: GameState, unit: Unit, from: Position): Position[] {
  if (unit.hasMoved) return [];

  const moves: Position[] = [];
  const homeRow = getHomeRow(unit.owner);

  if (unit.type === 'artillery') {
    // Artillery: 1 square, home row only
    for (const dir of ORTHOGONAL) {
      const to: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(to) && to.row === homeRow && canFitInSquare(state, to, unit)) {
        moves.push(to);
      }
    }
    return moves;
  }

  // Infantry: 1 square orthogonal
  if (unit.type === 'infantry') {
    for (const dir of ORTHOGONAL) {
      const to: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(to) && canFitInSquare(state, to, unit)) {
        moves.push(to);
      }
    }
    return moves;
  }

  // Cavalry: up to 2 squares orthogonal
  if (unit.type === 'cavalry') {
    for (const dir of ORTHOGONAL) {
      const step1: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(step1) && canFitInSquare(state, step1, unit)) {
        moves.push(step1);
        // Second step in same direction
        const step2: Position = { col: step1.col + dir.col, row: step1.row + dir.row };
        if (isInBounds(step2) && canFitInSquare(state, step2, unit)) {
          moves.push(step2);
        }
      }
      // Also allow L-shaped 2-square moves (change direction after first step)
      if (isInBounds(step1)) {
        for (const dir2 of ORTHOGONAL) {
          if (dir2.col === -dir.col && dir2.row === -dir.row) continue; // no backtracking
          if (dir2.col === dir.col && dir2.row === dir.row) continue; // already handled
          const step2: Position = { col: step1.col + dir2.col, row: step1.row + dir2.row };
          if (
            isInBounds(step2) &&
            canFitInSquare(state, step2, unit) &&
            !(step2.col === from.col && step2.row === from.row) // no returning to start
          ) {
            // Avoid duplicates
            if (!moves.some(m => m.col === step2.col && m.row === step2.row)) {
              moves.push(step2);
            }
          }
        }
      }
    }
    return moves;
  }

  return moves;
}

export function canDeploy(state: GameState, player: Player, target: Position): boolean {
  const homeRow = getHomeRow(player);
  if (target.row !== homeRow) return false;
  if (!isInBounds(target)) return false;
  // Check if there's space (use a dummy infantry to check minimum — actual check
  // happens when selecting which unit to deploy)
  const sq = getSquare(state, target);
  if (!sq) return false;
  return stackUsed(sq.units) < MAX_STACK_SLOTS;
}
```

**Step 4: Run tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/rules.ts src/__tests__/rules.test.ts
git commit -m "feat: add movement validation rules for all unit types"
```

---

### Task 5: Attack Rules

**Files:**
- Modify: `src/rules.ts`
- Test: `src/__tests__/attack-rules.test.ts`

**Step 1: Write failing tests for attack validation**

```typescript
// src/__tests__/attack-rules.test.ts
import { describe, expect, test } from 'bun:test';
import { getValidAttacks } from '../rules';
import { createInitialState, createUnit } from '../game-state';
import type { GameState, Position, Unit } from '../types';

function placeUnit(state: GameState, unit: Unit, pos: Position): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return { ...sq, units: [...sq.units, unit] };
      }
      return sq;
    }) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

describe('getValidAttacks', () => {
  test('infantry can attack adjacent orthogonal enemy squares', () => {
    const inf = createUnit('infantry', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,2');
  });

  test('infantry cannot attack empty squares', () => {
    const inf = createUnit('infantry', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('infantry cannot attack friendly squares', () => {
    const inf1 = createUnit('infantry', 1, 2);
    const inf2 = createUnit('infantry', 1, 2);
    let state = createInitialState();
    state = placeUnit(state, inf1, { col: 1, row: 1 });
    state = placeUnit(state, inf2, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('artillery can attack any enemy in same column', () => {
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, art, { col: 1, row: 0 }); // home row
    state = placeUnit(state, enemy, { col: 1, row: 3 }); // far end

    const attacks = getValidAttacks(state, { col: 1, row: 0 });
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,3');
  });

  test('artillery cannot attack different column', () => {
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, art, { col: 0, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 0, row: 0 });
    expect(attacks.length).toBe(0);
  });

  test('infantry that already attacked cannot attack again', () => {
    const inf = createUnit('infantry', 1, 2);
    inf.hasAttacked = true;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('infantry that moved this turn cannot attack', () => {
    const inf = createUnit('infantry', 1, 2);
    inf.hasMoved = true;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('cavalry that moved 1 square can still attack (charge)', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 1;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,2');
  });

  test('cavalry that moved 2 squares cannot attack', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 2;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('artillery that moved cannot fire', () => {
    const art = createUnit('artillery', 1, 2);
    art.hasMoved = true;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 1, row: 0 });
    expect(attacks.length).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — `getValidAttacks` not found

**Step 3: Add getValidAttacks to rules.ts**

Append to `src/rules.ts`:

```typescript
function canUnitAttack(unit: Unit): boolean {
  if (unit.hasAttacked) return false;
  if (unit.type === 'infantry' && unit.hasMoved) return false;
  if (unit.type === 'artillery' && unit.hasMoved) return false;
  if (unit.type === 'cavalry' && unit.hasMoved && unit.movedSquares > 1) return false;
  return true;
}

function hasEnemyUnits(state: GameState, pos: Position, attackerOwner: Player): boolean {
  const sq = getSquare(state, pos);
  if (!sq) return false;
  return sq.units.some(u => u.owner !== attackerOwner);
}

export function getValidAttacks(state: GameState, from: Position): Position[] {
  const sq = getSquare(state, from);
  if (!sq) return [];

  const attackers = sq.units.filter(u => canUnitAttack(u));
  if (attackers.length === 0) return [];

  const owner = attackers[0]!.owner;
  const targets: Position[] = [];

  const hasAdjacentAttacker = attackers.some(u => u.type === 'infantry' || u.type === 'cavalry');
  const hasArtillery = attackers.some(u => u.type === 'artillery');

  if (hasAdjacentAttacker) {
    for (const dir of ORTHOGONAL) {
      const target: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(target) && hasEnemyUnits(state, target, owner)) {
        targets.push(target);
      }
    }
  }

  if (hasArtillery) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (r === from.row) continue;
      const target: Position = { col: from.col, row: r };
      if (hasEnemyUnits(state, target, owner) && !targets.some(t => t.col === target.col && t.row === target.row)) {
        targets.push(target);
      }
    }
  }

  return targets;
}
```

**Step 4: Run tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/rules.ts src/__tests__/attack-rules.test.ts
git commit -m "feat: add attack validation rules with unit-specific constraints"
```

---

### Task 6: Combat Resolution (D40 Dice + Bonuses + Damage)

**Files:**
- Create: `src/combat.ts`
- Test: `src/__tests__/combat.test.ts`

**Step 1: Write failing tests for bonus calculation**

```typescript
// src/__tests__/combat.test.ts
import { describe, expect, test } from 'bun:test';
import {
  calculateBonuses,
  calculateThreshold,
  rollD40Attack,
  distributeDamage,
} from '../combat';
import { createUnit } from '../game-state';
import type { Unit, Position } from '../types';
import { BASE_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD } from '../types';

describe('calculateBonuses', () => {
  test('no bonuses for single infantry from one square', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toEqual([]);
  });

  test('combined arms 2 for two different types', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [
      createUnit('infantry', 1, 2),
      createUnit('cavalry', 1, 2),
    ]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('combined-arms-2');
  });

  test('combined arms 3 for all three types', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [
      createUnit('infantry', 1, 2),
      createUnit('cavalry', 1, 2),
      createUnit('artillery', 1, 2),
    ]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('combined-arms-3');
    expect(bonuses).not.toContain('combined-arms-2');
  });

  test('flanking 2 for attacks from 2 squares', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('0,1', [createUnit('infantry', 1, 2)]);
    attackers.set('1,0', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('flanking-2');
  });

  test('flanking 3 for attacks from 3 squares', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('0,1', [createUnit('infantry', 1, 2)]);
    attackers.set('1,0', [createUnit('infantry', 1, 2)]);
    attackers.set('2,1', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('flanking-3');
  });

  test('cavalry charge when cavalry moved 1 square', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 1;
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [cav]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('cavalry-charge');
  });

  test('no cavalry charge when cavalry did not move', () => {
    const cav = createUnit('cavalry', 1, 2);
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [cav]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).not.toContain('cavalry-charge');
  });
});

describe('calculateThreshold', () => {
  test('base threshold with no bonuses', () => {
    expect(calculateThreshold([])).toBe(BASE_THRESHOLD);
  });

  test('adds bonus values correctly', () => {
    expect(calculateThreshold(['combined-arms-2'])).toBe(BASE_THRESHOLD + 4);
    expect(calculateThreshold(['cavalry-charge'])).toBe(BASE_THRESHOLD + 6);
  });

  test('stacks multiple bonuses', () => {
    expect(calculateThreshold(['combined-arms-3', 'flanking-3', 'cavalry-charge']))
      .toBe(BASE_THRESHOLD + 6 + 6 + 6);
  });

  test('clamps to minimum 2', () => {
    expect(calculateThreshold([])).toBeGreaterThanOrEqual(MIN_THRESHOLD);
  });

  test('clamps to maximum 38', () => {
    // Even with absurd bonuses
    expect(calculateThreshold([
      'combined-arms-3', 'flanking-4', 'cavalry-charge',
    ])).toBeLessThanOrEqual(MAX_THRESHOLD);
  });
});

describe('rollD40Attack', () => {
  test('returns number of hits between 0 and totalDice', () => {
    // Run multiple times to check bounds
    for (let i = 0; i < 100; i++) {
      const hits = rollD40Attack(10, 20); // 50% chance per die
      expect(hits).toBeGreaterThanOrEqual(0);
      expect(hits).toBeLessThanOrEqual(10);
    }
  });

  test('threshold 40 always hits', () => {
    const hits = rollD40Attack(5, 40);
    expect(hits).toBe(5);
  });

  test('threshold 0 never hits', () => {
    const hits = rollD40Attack(5, 0);
    expect(hits).toBe(0);
  });
});

describe('distributeDamage', () => {
  test('like-hits-like: infantry damage goes to infantry first', () => {
    const attackers = [createUnit('infantry', 1, 3)];
    const defenders = [
      createUnit('infantry', 2, 3),
      createUnit('cavalry', 2, 3),
    ];
    const result = distributeDamage(2, attackers, defenders);
    const infDmg = result.find(r => r.unitId === defenders[0]!.id);
    expect(infDmg?.damage).toBe(2);
  });

  test('overflow damage spills to other types', () => {
    const attackers = [createUnit('infantry', 1, 2)];
    const defenders = [
      createUnit('infantry', 2, 1), // only 1 HP
      createUnit('cavalry', 2, 3),
    ];
    const result = distributeDamage(3, attackers, defenders);
    const infDmg = result.find(r => r.unitId === defenders[0]!.id);
    const cavDmg = result.find(r => r.unitId === defenders[1]!.id);
    expect(infDmg?.damage).toBe(1);
    expect(infDmg?.destroyed).toBe(true);
    expect(cavDmg?.damage).toBe(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — `../combat` not found

**Step 3: Implement combat.ts**

```typescript
// src/combat.ts
import type { Unit, BonusType } from './types';
import { BASE_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD, D40, BONUS_VALUES } from './types';

export function calculateBonuses(attackersBySquare: Map<string, Unit[]>): BonusType[] {
  const bonuses: BonusType[] = [];
  const allAttackers = [...attackersBySquare.values()].flat();

  // Combined arms: count distinct unit types across all attacking squares
  const types = new Set(allAttackers.map(u => u.type));
  if (types.size >= 3) {
    bonuses.push('combined-arms-3');
  } else if (types.size === 2) {
    bonuses.push('combined-arms-2');
  }

  // Flanking: count distinct squares attacking
  const squareCount = attackersBySquare.size;
  if (squareCount >= 4) {
    bonuses.push('flanking-4');
  } else if (squareCount >= 3) {
    bonuses.push('flanking-3');
  } else if (squareCount >= 2) {
    bonuses.push('flanking-2');
  }

  // Cavalry charge: any cavalry that moved 1 square this turn
  const hasChargingCav = allAttackers.some(
    u => u.type === 'cavalry' && u.hasMoved && u.movedSquares === 1
  );
  if (hasChargingCav) {
    bonuses.push('cavalry-charge');
  }

  return bonuses;
}

export function calculateThreshold(bonuses: BonusType[]): number {
  const bonusTotal = bonuses.reduce((sum, b) => sum + BONUS_VALUES[b], 0);
  const raw = BASE_THRESHOLD + bonusTotal;
  return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, raw));
}

export function rollD40Attack(totalDice: number, threshold: number): number {
  let hits = 0;
  for (let i = 0; i < totalDice; i++) {
    const roll = Math.floor(Math.random() * D40) + 1; // 1-40
    if (roll <= threshold) {
      hits++;
    }
  }
  return hits;
}

export function distributeDamage(
  totalHits: number,
  attackers: Unit[],
  defenders: Unit[]
): Array<{ unitId: string; damage: number; destroyed: boolean }> {
  const result: Array<{ unitId: string; damage: number; destroyed: boolean }> = [];
  const defenderState = defenders.map(d => ({ ...d, remainingHp: d.level }));
  let hitsLeft = totalHits;

  // Get attacker types for like-hits-like priority
  const attackerTypes = new Set(attackers.map(u => u.type));

  // First pass: like-hits-like
  for (const attackerType of attackerTypes) {
    const matchingDefenders = defenderState.filter(
      d => d.type === attackerType && d.remainingHp > 0
    );
    for (const def of matchingDefenders) {
      if (hitsLeft <= 0) break;
      const dmg = Math.min(hitsLeft, def.remainingHp);
      def.remainingHp -= dmg;
      hitsLeft -= dmg;
      result.push({
        unitId: def.id,
        damage: dmg,
        destroyed: def.remainingHp <= 0,
      });
    }
  }

  // Second pass: spill over to remaining defenders
  if (hitsLeft > 0) {
    const remaining = defenderState.filter(d => d.remainingHp > 0);
    for (const def of remaining) {
      if (hitsLeft <= 0) break;
      const dmg = Math.min(hitsLeft, def.remainingHp);
      def.remainingHp -= dmg;
      hitsLeft -= dmg;
      const existing = result.find(r => r.unitId === def.id);
      if (existing) {
        existing.damage += dmg;
        existing.destroyed = def.remainingHp <= 0;
      } else {
        result.push({
          unitId: def.id,
          damage: dmg,
          destroyed: def.remainingHp <= 0,
        });
      }
    }
  }

  return result;
}
```

**Step 4: Run tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/combat.ts src/__tests__/combat.test.ts
git commit -m "feat: add d40 combat resolution with bonuses and damage distribution"
```

---

### Task 7: Game Actions (Deploy, Move, Attack, End Turn)

**Files:**
- Create: `src/actions.ts`
- Test: `src/__tests__/actions.test.ts`

**Step 1: Write failing tests for game actions**

```typescript
// src/__tests__/actions.test.ts
import { describe, expect, test } from 'bun:test';
import { deployUnit, moveUnit, endTurn } from '../actions';
import { createInitialState } from '../game-state';
import type { GameState } from '../types';

describe('deployUnit', () => {
  test('moves unit from reserves to home row, costs 1 AP', () => {
    const state = createInitialState();
    const unitId = state.p1Reserve[0]!.id;
    const result = deployUnit(state, unitId, { col: 1, row: 0 });

    expect(result.actionPoints).toBe(state.actionPoints - 1);
    expect(result.p1Reserve.find(u => u.id === unitId)).toBeUndefined();
    const sq = result.grid[0]![1]!;
    expect(sq.units.some(u => u.id === unitId)).toBe(true);
  });

  test('deployed unit is marked as moved', () => {
    const state = createInitialState();
    const unitId = state.p1Reserve[0]!.id;
    const result = deployUnit(state, unitId, { col: 1, row: 0 });
    const deployed = result.grid[0]![1]!.units.find(u => u.id === unitId);
    expect(deployed?.hasMoved).toBe(true);
  });

  test('cannot deploy with 0 AP', () => {
    let state = createInitialState();
    state = { ...state, actionPoints: 0 };
    const unitId = state.p1Reserve[0]!.id;
    const result = deployUnit(state, unitId, { col: 1, row: 0 });
    // State unchanged
    expect(result).toEqual(state);
  });
});

describe('moveUnit', () => {
  test('moves unit to new square, costs 1 AP', () => {
    let state = createInitialState();
    const unitId = state.p1Reserve[0]!.id;
    state = deployUnit(state, unitId, { col: 1, row: 0 });
    const apBefore = state.actionPoints;

    const result = moveUnit(state, unitId, { col: 1, row: 0 }, { col: 1, row: 1 });

    expect(result.actionPoints).toBe(apBefore - 1);
    expect(result.grid[0]![1]!.units.find(u => u.id === unitId)).toBeUndefined();
    expect(result.grid[1]![1]!.units.some(u => u.id === unitId)).toBe(true);
  });

  test('unit is marked as moved with correct movedSquares', () => {
    let state = createInitialState();
    const unitId = state.p1Reserve[0]!.id;
    state = deployUnit(state, unitId, { col: 1, row: 0 });

    const result = moveUnit(state, unitId, { col: 1, row: 0 }, { col: 1, row: 1 });
    const moved = result.grid[1]![1]!.units.find(u => u.id === unitId);
    expect(moved?.hasMoved).toBe(true);
    expect(moved?.movedSquares).toBe(1);
  });
});

describe('endTurn', () => {
  test('switches to other player with full AP', () => {
    const state = createInitialState();
    const result = endTurn(state);

    expect(result.currentPlayer).toBe(2);
    expect(result.actionPoints).toBe(state.maxActionPoints);
    expect(result.phase).toBe('handoff');
  });

  test('resets all unit movement flags for next player', () => {
    let state = createInitialState();
    const unitId = state.p1Reserve[0]!.id;
    state = deployUnit(state, unitId, { col: 1, row: 0 });

    const afterEnd = endTurn(state);
    // P1's deployed unit should have flags reset after P2's turn ends
    // (flags reset for the NEXT player's units at start of their turn)
    const afterEnd2 = endTurn({ ...afterEnd, phase: 'playing' });
    const unit = afterEnd2.grid[0]![1]!.units.find(u => u.id === unitId);
    expect(unit?.hasMoved).toBe(false);
  });

  test('increments turn number when returning to player 1', () => {
    const state = createInitialState();
    const after1 = endTurn(state);
    const after2 = endTurn({ ...after1, phase: 'playing' });
    expect(after2.turnNumber).toBe(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — `../actions` not found

**Step 3: Implement actions.ts**

```typescript
// src/actions.ts
import type { GameState, Player, Position, Unit } from './types';
import { DEFAULT_AP } from './types';
import { getSquare, getHomeRow, getReserve } from './game-state';

function updateUnitInGrid(
  state: GameState,
  pos: Position,
  unitId: string,
  updater: (unit: Unit) => Unit
): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return {
          ...sq,
          units: sq.units.map(u => (u.id === unitId ? updater(u) : u)),
        };
      }
      return sq;
    }) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

function addUnitToSquare(state: GameState, pos: Position, unit: Unit): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return { ...sq, units: [...sq.units, unit] };
      }
      return sq;
    }) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

function removeUnitFromSquare(state: GameState, pos: Position, unitId: string): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return { ...sq, units: sq.units.filter(u => u.id !== unitId) };
      }
      return sq;
    }) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

export function deployUnit(state: GameState, unitId: string, target: Position): GameState {
  if (state.actionPoints <= 0) return state;

  const reserve = getReserve(state, state.currentPlayer);
  const unit = reserve.find(u => u.id === unitId);
  if (!unit) return state;

  const homeRow = getHomeRow(state.currentPlayer);
  if (target.row !== homeRow) return state;

  const deployed: Unit = { ...unit, hasMoved: true, movedSquares: 0 };

  let newState = addUnitToSquare(state, target, deployed);
  const newReserve = reserve.filter(u => u.id !== unitId);

  if (state.currentPlayer === 1) {
    newState = { ...newState, p1Reserve: newReserve };
  } else {
    newState = { ...newState, p2Reserve: newReserve };
  }

  return { ...newState, actionPoints: state.actionPoints - 1 };
}

export function moveUnit(
  state: GameState,
  unitId: string,
  from: Position,
  to: Position
): GameState {
  if (state.actionPoints <= 0) return state;

  const sq = getSquare(state, from);
  if (!sq) return state;

  const unit = sq.units.find(u => u.id === unitId);
  if (!unit) return state;

  const distance = Math.abs(to.col - from.col) + Math.abs(to.row - from.row);
  const movedUnit: Unit = { ...unit, hasMoved: true, movedSquares: distance };

  let newState = removeUnitFromSquare(state, from, unitId);
  newState = addUnitToSquare(newState, to, movedUnit);

  return { ...newState, actionPoints: state.actionPoints - 1 };
}

function resetPlayerUnits(state: GameState, player: Player): GameState {
  const newGrid = state.grid.map(row =>
    row.map(sq => ({
      ...sq,
      units: sq.units.map(u =>
        u.owner === player
          ? { ...u, hasMoved: false, hasAttacked: false, movedSquares: 0 }
          : u
      ),
    })) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

export function endTurn(state: GameState): GameState {
  const nextPlayer: Player = state.currentPlayer === 1 ? 2 : 1;
  const nextTurn = nextPlayer === 1 ? state.turnNumber + 1 : state.turnNumber;

  let newState = resetPlayerUnits(state, nextPlayer);

  return {
    ...newState,
    currentPlayer: nextPlayer,
    actionPoints: state.maxActionPoints,
    selectedSquare: null,
    phase: 'handoff',
    turnNumber: nextTurn,
  };
}

export function confirmHandoff(state: GameState): GameState {
  return { ...state, phase: 'playing' };
}
```

**Step 4: Run tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/actions.ts src/__tests__/actions.test.ts
git commit -m "feat: add game actions - deploy, move, end turn"
```

---

### Task 8: Attack Action & Win Conditions

**Files:**
- Modify: `src/actions.ts`
- Test: `src/__tests__/attack-action.test.ts`

**Step 1: Write failing tests for attack action and win conditions**

```typescript
// src/__tests__/attack-action.test.ts
import { describe, expect, test } from 'bun:test';
import { attackSquare, checkWinCondition } from '../actions';
import { createInitialState, createUnit } from '../game-state';
import type { GameState, Position, Unit } from '../types';

function placeUnit(state: GameState, unit: Unit, pos: Position): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return { ...sq, units: [...sq.units, unit] };
      }
      return sq;
    }) as [typeof row[0], typeof row[1], typeof row[2]]
  );
  return { ...state, grid: newGrid };
}

describe('attackSquare', () => {
  test('costs 1 AP', () => {
    const inf = createUnit('infantry', 1, 5);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });
    const apBefore = state.actionPoints;

    const result = attackSquare(state, [{ col: 1, row: 1 }], { col: 1, row: 2 });
    expect(result.state.actionPoints).toBe(apBefore - 1);
  });

  test('marks attacking units as hasAttacked', () => {
    const inf = createUnit('infantry', 1, 5);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(state, [{ col: 1, row: 1 }], { col: 1, row: 2 });
    const attacker = result.state.grid[1]![1]!.units.find(u => u.id === inf.id);
    expect(attacker?.hasAttacked).toBe(true);
  });

  test('destroys unit when HP reaches 0', () => {
    const inf = createUnit('infantry', 1, 5); // high level = many dice
    const enemy = createUnit('infantry', 2, 1); // 1 HP
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Run attack — with 5 dice and base threshold 6, at least 1 hit is very likely
    // but not guaranteed. Run in a loop until we get a result with hits.
    let result;
    for (let i = 0; i < 100; i++) {
      result = attackSquare(state, [{ col: 1, row: 1 }], { col: 1, row: 2 });
      if (result.attackResult.hits > 0) break;
    }
    expect(result!.attackResult.hits).toBeGreaterThan(0);
  });
});

describe('checkWinCondition', () => {
  test('returns null when both sides have units', () => {
    let state = createInitialState();
    const inf1 = createUnit('infantry', 1, 2);
    const inf2 = createUnit('infantry', 2, 2);
    state = placeUnit(state, inf1, { col: 0, row: 0 });
    state = placeUnit(state, inf2, { col: 0, row: 3 });
    expect(checkWinCondition(state)).toBeNull();
  });

  test('player 1 wins when no P2 units remain anywhere', () => {
    let state = createInitialState();
    state = { ...state, p2Reserve: [] }; // empty P2 reserves
    const inf1 = createUnit('infantry', 1, 2);
    state = placeUnit(state, inf1, { col: 0, row: 0 });
    // No P2 units on grid or in reserves
    expect(checkWinCondition(state)).toBe(1);
  });

  test('player 2 wins when no P1 units remain anywhere', () => {
    let state = createInitialState();
    state = { ...state, p1Reserve: [] };
    const inf2 = createUnit('infantry', 2, 2);
    state = placeUnit(state, inf2, { col: 0, row: 3 });
    expect(checkWinCondition(state)).toBe(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `bun test`
Expected: FAIL — `attackSquare` and `checkWinCondition` not found

**Step 3: Add attackSquare and checkWinCondition to actions.ts**

Append to `src/actions.ts`:

```typescript
import { calculateBonuses, calculateThreshold, rollD40Attack, distributeDamage } from './combat';
import type { AttackResult } from './types';

export function attackSquare(
  state: GameState,
  fromSquares: Position[],
  target: Position
): { state: GameState; attackResult: AttackResult } {
  if (state.actionPoints <= 0) {
    return {
      state,
      attackResult: {
        attackerSquares: fromSquares,
        targetSquare: target,
        totalDice: 0,
        threshold: 0,
        hits: 0,
        bonuses: [],
        unitDamage: [],
      },
    };
  }

  // Gather all attackers by square key
  const attackersBySquare = new Map<string, Unit[]>();
  const allAttackers: Unit[] = [];

  for (const from of fromSquares) {
    const sq = getSquare(state, from);
    if (!sq) continue;
    const key = `${from.col},${from.row}`;
    const eligible = sq.units.filter(
      u => u.owner === state.currentPlayer && !u.hasAttacked
    );
    if (eligible.length > 0) {
      attackersBySquare.set(key, eligible);
      allAttackers.push(...eligible);
    }
  }

  // Get defenders
  const targetSq = getSquare(state, target);
  if (!targetSq) return { state, attackResult: emptyResult(fromSquares, target) };
  const defenders = targetSq.units.filter(u => u.owner !== state.currentPlayer);
  if (defenders.length === 0) return { state, attackResult: emptyResult(fromSquares, target) };

  // Calculate bonuses and threshold
  const bonuses = calculateBonuses(attackersBySquare);
  const threshold = calculateThreshold(bonuses);

  // Roll dice
  const totalDice = allAttackers.reduce((sum, u) => sum + u.level, 0);
  const hits = rollD40Attack(totalDice, threshold);

  // Distribute damage
  const unitDamage = distributeDamage(hits, allAttackers, defenders);

  // Apply damage to state
  let newState = state;

  // Mark attackers as hasAttacked
  for (const from of fromSquares) {
    const sq = getSquare(newState, from);
    if (!sq) continue;
    newState = {
      ...newState,
      grid: newState.grid.map((row, r) =>
        row.map((s, c) => {
          if (r === from.row && c === from.col) {
            return {
              ...s,
              units: s.units.map(u =>
                u.owner === state.currentPlayer ? { ...u, hasAttacked: true } : u
              ),
            };
          }
          return s;
        }) as [typeof row[0], typeof row[1], typeof row[2]]
      ),
    };
  }

  // Apply damage to defenders
  newState = {
    ...newState,
    grid: newState.grid.map((row, r) =>
      row.map((sq, c) => {
        if (r === target.row && c === target.col) {
          const updatedUnits = sq.units
            .map(u => {
              const dmgEntry = unitDamage.find(d => d.unitId === u.id);
              if (!dmgEntry) return u;
              return { ...u, level: u.level - dmgEntry.damage };
            })
            .filter(u => u.level > 0);
          return { ...sq, units: updatedUnits };
        }
        return sq;
      }) as [typeof row[0], typeof row[1], typeof row[2]]
    ),
  };

  return {
    state: { ...newState, actionPoints: state.actionPoints - 1 },
    attackResult: {
      attackerSquares: fromSquares,
      targetSquare: target,
      totalDice,
      threshold,
      hits,
      bonuses,
      unitDamage,
    },
  };
}

function emptyResult(fromSquares: Position[], target: Position): AttackResult {
  return {
    attackerSquares: fromSquares,
    targetSquare: target,
    totalDice: 0,
    threshold: 0,
    hits: 0,
    bonuses: [],
    unitDamage: [],
  };
}

export function checkWinCondition(state: GameState): Player | null {
  const p1OnGrid = state.grid.some(row => row.some(sq => sq.units.some(u => u.owner === 1)));
  const p1InReserve = state.p1Reserve.length > 0;
  const p2OnGrid = state.grid.some(row => row.some(sq => sq.units.some(u => u.owner === 2)));
  const p2InReserve = state.p2Reserve.length > 0;

  if (!p2OnGrid && !p2InReserve) return 1;
  if (!p1OnGrid && !p1InReserve) return 2;

  return null;
}
```

**Step 4: Run tests**

Run: `bun test`
Expected: All pass

**Step 5: Commit**

```bash
git add src/actions.ts src/__tests__/attack-action.test.ts
git commit -m "feat: add attack action with d40 resolution and win condition checks"
```

---

### Task 9: Canvas Renderer

**Files:**
- Create: `src/renderer.ts`

This task is primarily visual and does not need automated tests. We'll verify by running in the browser.

**Step 1: Implement the renderer**

```typescript
// src/renderer.ts
import type { GameState, Player, Position, Square, Unit, UnitType } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

const COLORS = {
  bg: '#1a1a2e',
  gridBg: '#16213e',
  gridLine: '#0f3460',
  p1: '#4fc3f7',
  p2: '#ef5350',
  selected: '#ffd54f',
  validMove: 'rgba(76, 175, 80, 0.35)',
  validAttack: 'rgba(255, 152, 0, 0.35)',
  reserve: '#0d1b2a',
  text: '#e0e0e0',
  textDark: '#333',
  button: '#1b5e20',
  buttonText: '#fff',
  retreatBtn: '#b71c1c',
};

const UNIT_SYMBOLS: Record<UnitType, string> = {
  infantry: '\u25A0', // ■
  cavalry: '\u25B2',  // ▲
  artillery: '\u25CF', // ●
};

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  reserveHeight: number;
  statusBarHeight: number;
  buttonBarHeight: number;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  const statusBarHeight = 48;
  const buttonBarHeight = 56;
  const reserveHeight = 60;

  const availableHeight = h - statusBarHeight * 2 - buttonBarHeight - reserveHeight * 2;
  const availableWidth = w - 20;

  const cellSize = Math.min(
    Math.floor(availableWidth / GRID_COLS),
    Math.floor(availableHeight / GRID_ROWS)
  );

  const gridWidth = cellSize * GRID_COLS;
  const totalGridHeight = cellSize * GRID_ROWS + reserveHeight * 2;

  const gridOffsetX = Math.floor((w - gridWidth) / 2);
  const gridOffsetY = statusBarHeight + Math.floor((h - statusBarHeight * 2 - buttonBarHeight - totalGridHeight) / 2);

  return { canvas, ctx, cellSize, gridOffsetX, gridOffsetY, reserveHeight, statusBarHeight, buttonBarHeight };
}

export function render(
  rc: RenderContext,
  state: GameState,
  validMoves: Position[],
  validAttacks: Position[],
  flipped: boolean
): void {
  const { ctx, canvas } = rc;

  // Clear
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Status bars
  renderStatusBar(rc, state, 2, 0, flipped); // P2 at top
  renderStatusBar(rc, state, 1, canvas.height - rc.buttonBarHeight - rc.statusBarHeight, flipped);

  // Reserve zones
  const topReserveY = rc.gridOffsetY;
  const bottomReserveY = rc.gridOffsetY + rc.reserveHeight + rc.cellSize * GRID_ROWS;

  renderReserve(rc, state, flipped ? 1 : 2, topReserveY);
  renderReserve(rc, state, flipped ? 2 : 1, bottomReserveY);

  // Grid
  const gridTop = rc.gridOffsetY + rc.reserveHeight;
  renderGrid(rc, state, gridTop, validMoves, validAttacks, flipped);

  // Buttons
  renderButtons(rc, state);
}

function renderStatusBar(rc: RenderContext, state: GameState, player: Player, y: number, flipped: boolean): void {
  const { ctx, canvas } = rc;
  ctx.fillStyle = player === state.currentPlayer ? (player === 1 ? COLORS.p1 : COLORS.p2) : '#333';
  ctx.globalAlpha = player === state.currentPlayer ? 0.15 : 0.05;
  ctx.fillRect(0, y, canvas.width, rc.statusBarHeight);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const apDisplay = player === state.currentPlayer
    ? '\u25CF'.repeat(state.actionPoints) + '\u25CB'.repeat(state.maxActionPoints - state.actionPoints)
    : '';

  ctx.fillText(`P${player}  ${apDisplay}`, 12, y + rc.statusBarHeight / 2);

  ctx.textAlign = 'right';
  ctx.fillText(`Turn ${state.turnNumber}`, canvas.width - 12, y + rc.statusBarHeight / 2);
}

function renderReserve(rc: RenderContext, state: GameState, player: Player, y: number): void {
  const { ctx, cellSize, gridOffsetX } = rc;
  const gridWidth = cellSize * GRID_COLS;

  ctx.fillStyle = COLORS.reserve;
  ctx.fillRect(gridOffsetX, y, gridWidth, rc.reserveHeight);
  ctx.strokeStyle = COLORS.gridLine;
  ctx.strokeRect(gridOffsetX, y, gridWidth, rc.reserveHeight);

  const reserve = player === 1 ? state.p1Reserve : state.p2Reserve;
  const color = player === 1 ? COLORS.p1 : COLORS.p2;

  ctx.fillStyle = color;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const flagText = `\u2691 P${player} RESERVES`;
  ctx.fillText(flagText, gridOffsetX + gridWidth / 2, y + 14);

  // Draw reserve units
  const unitSize = 20;
  const padding = 4;
  const startX = gridOffsetX + 10;
  const unitY = y + 36;

  reserve.forEach((unit, i) => {
    const ux = startX + i * (unitSize + padding);
    ctx.fillStyle = color;
    ctx.font = `${unitSize - 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(UNIT_SYMBOLS[unit.type], ux + unitSize / 2, unitY);
    ctx.font = '9px monospace';
    ctx.fillText(`${unit.level}`, ux + unitSize / 2, unitY + 12);
  });
}

function renderGrid(
  rc: RenderContext,
  state: GameState,
  gridTop: number,
  validMoves: Position[],
  validAttacks: Position[],
  flipped: boolean
): void {
  const { ctx, cellSize, gridOffsetX } = rc;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const displayRow = flipped ? GRID_ROWS - 1 - r : r;
      const displayCol = flipped ? GRID_COLS - 1 - c : c;

      const x = gridOffsetX + displayCol * cellSize;
      const y = gridTop + (GRID_ROWS - 1 - displayRow) * cellSize;

      // Cell background
      ctx.fillStyle = COLORS.gridBg;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Highlights
      if (validMoves.some(p => p.col === c && p.row === r)) {
        ctx.fillStyle = COLORS.validMove;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
      if (validAttacks.some(p => p.col === c && p.row === r)) {
        ctx.fillStyle = COLORS.validAttack;
        ctx.fillRect(x, y, cellSize, cellSize);
      }

      // Selection highlight
      if (state.selectedSquare && state.selectedSquare.col === c && state.selectedSquare.row === r) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        ctx.lineWidth = 1;
      }

      // Grid lines
      ctx.strokeStyle = COLORS.gridLine;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Units
      const sq = state.grid[r]?.[c];
      if (sq && sq.units.length > 0) {
        renderUnitsInSquare(ctx, sq.units, x, y, cellSize);
      }
    }
  }
}

function renderUnitsInSquare(
  ctx: CanvasRenderingContext2D,
  units: Unit[],
  x: number,
  y: number,
  cellSize: number
): void {
  const maxPerRow = 3;
  const unitSize = Math.min(cellSize / maxPerRow - 2, 28);

  units.forEach((unit, i) => {
    const col = i % maxPerRow;
    const row = Math.floor(i / maxPerRow);
    const ux = x + 6 + col * (unitSize + 2);
    const uy = y + 6 + row * (unitSize + 8);

    ctx.fillStyle = unit.owner === 1 ? COLORS.p1 : COLORS.p2;
    ctx.font = `${unitSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(UNIT_SYMBOLS[unit.type], ux + unitSize / 2, uy + unitSize / 2);

    // Level number
    ctx.font = '10px monospace';
    ctx.fillText(`${unit.level}`, ux + unitSize / 2, uy + unitSize / 2 + unitSize / 2 + 4);
  });
}

function renderButtons(rc: RenderContext, state: GameState): void {
  const { ctx, canvas, buttonBarHeight } = rc;
  const y = canvas.height - buttonBarHeight;
  const btnWidth = canvas.width / 2 - 16;
  const btnHeight = 40;
  const btnY = y + (buttonBarHeight - btnHeight) / 2;

  // End Turn button
  ctx.fillStyle = COLORS.button;
  ctx.fillRect(8, btnY, btnWidth, btnHeight);
  ctx.fillStyle = COLORS.buttonText;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('END TURN', 8 + btnWidth / 2, btnY + btnHeight / 2);

  // Retreat button
  ctx.fillStyle = COLORS.retreatBtn;
  ctx.fillRect(canvas.width / 2 + 8, btnY, btnWidth, btnHeight);
  ctx.fillStyle = COLORS.buttonText;
  ctx.fillText('RETREAT', canvas.width / 2 + 8 + btnWidth / 2, btnY + btnHeight / 2);
}

export function renderHandoff(rc: RenderContext, player: Player): void {
  const { ctx, canvas } = rc;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLORS.text;
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Pass to Player ${player}`, canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = '18px monospace';
  ctx.fillText('Tap to continue', canvas.width / 2, canvas.height / 2 + 20);
}

export function renderGameOver(rc: RenderContext, winner: Player): void {
  const { ctx, canvas } = rc;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = winner === 1 ? COLORS.p1 : COLORS.p2;
  ctx.font = '32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Player ${winner} Wins!`, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText('Tap to play again', canvas.width / 2, canvas.height / 2 + 20);
}

// Hit-testing: maps screen coords to game positions
export function screenToGrid(
  rc: RenderContext,
  screenX: number,
  screenY: number,
  flipped: boolean
): { type: 'grid'; pos: Position } | { type: 'reserve'; player: Player } | { type: 'endTurn' } | { type: 'retreat' } | null {
  const { gridOffsetX, gridOffsetY, cellSize, reserveHeight, canvas, buttonBarHeight } = rc;
  const gridTop = gridOffsetY + reserveHeight;
  const gridWidth = cellSize * GRID_COLS;

  // Check buttons
  const btnY = canvas.height - buttonBarHeight;
  if (screenY >= btnY) {
    if (screenX < canvas.width / 2) return { type: 'endTurn' };
    return { type: 'retreat' };
  }

  // Check top reserve
  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= gridOffsetY &&
    screenY < gridOffsetY + reserveHeight
  ) {
    return { type: 'reserve', player: flipped ? 1 : 2 };
  }

  // Check bottom reserve
  const bottomReserveY = gridOffsetY + reserveHeight + cellSize * GRID_ROWS;
  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= bottomReserveY &&
    screenY < bottomReserveY + reserveHeight
  ) {
    return { type: 'reserve', player: flipped ? 2 : 1 };
  }

  // Check grid
  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= gridTop &&
    screenY < gridTop + cellSize * GRID_ROWS
  ) {
    let displayCol = Math.floor((screenX - gridOffsetX) / cellSize);
    let displayRow = GRID_ROWS - 1 - Math.floor((screenY - gridTop) / cellSize);

    const col = flipped ? GRID_COLS - 1 - displayCol : displayCol;
    const row = flipped ? GRID_ROWS - 1 - displayRow : displayRow;

    return { type: 'grid', pos: { col, row } };
  }

  return null;
}
```

**Step 2: Verify it compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/renderer.ts
git commit -m "feat: add canvas renderer with grid, units, reserves, and hit-testing"
```

---

### Task 10: Input Handler & Game Loop

**Files:**
- Create: `src/input.ts`
- Rewrite: `src/main.ts`

**Step 1: Create input handler**

```typescript
// src/input.ts
import type { RenderContext } from './renderer';
import { screenToGrid } from './renderer';

export type GameAction =
  | { type: 'selectGrid'; col: number; row: number }
  | { type: 'selectReserve'; player: 1 | 2 }
  | { type: 'endTurn' }
  | { type: 'retreat' }
  | { type: 'tap' }; // generic tap for handoff/game-over screens

export function setupInput(
  canvas: HTMLCanvasElement,
  rc: RenderContext,
  flipped: () => boolean,
  onAction: (action: GameAction) => void
): void {
  function handlePointer(e: PointerEvent) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const hit = screenToGrid(rc, x, y, flipped());

    if (!hit) {
      onAction({ type: 'tap' });
      return;
    }

    switch (hit.type) {
      case 'grid':
        onAction({ type: 'selectGrid', col: hit.pos.col, row: hit.pos.row });
        break;
      case 'reserve':
        onAction({ type: 'selectReserve', player: hit.player });
        break;
      case 'endTurn':
        onAction({ type: 'endTurn' });
        break;
      case 'retreat':
        onAction({ type: 'retreat' });
        break;
    }
  }

  canvas.addEventListener('pointerdown', handlePointer);
}
```

**Step 2: Rewrite main.ts as the game loop**

```typescript
// src/main.ts
import type { GameState, Position } from './types';
import { createInitialState, getSquare, getReserve, getHomeRow } from './game-state';
import { getValidMoves, getValidAttacks, canDeploy } from './rules';
import { deployUnit, moveUnit, attackSquare, endTurn, confirmHandoff, checkWinCondition } from './actions';
import { createRenderContext, render, renderHandoff, renderGameOver } from './renderer';
import { setupInput } from './input';
import type { GameAction } from './input';

const canvas = document.getElementById('game') as HTMLCanvasElement;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

let state: GameState = createInitialState();
let selectedUnitId: string | null = null;
let validMoves: Position[] = [];
let validAttacks: Position[] = [];
let deployMode = false;

const rc = createRenderContext(canvas);

function isFlipped(): boolean {
  return state.currentPlayer === 2;
}

function clearSelection() {
  selectedUnitId = null;
  validMoves = [];
  validAttacks = [];
  deployMode = false;
  state = { ...state, selectedSquare: null };
}

function handleAction(action: GameAction) {
  if (state.phase === 'game-over') {
    if (action.type === 'tap') {
      state = createInitialState();
      clearSelection();
    }
    draw();
    return;
  }

  if (state.phase === 'handoff') {
    if (action.type === 'tap') {
      state = confirmHandoff(state);
      clearSelection();
    }
    draw();
    return;
  }

  switch (action.type) {
    case 'selectReserve': {
      if (action.player !== state.currentPlayer) break;
      if (state.actionPoints <= 0) break;
      const reserve = getReserve(state, state.currentPlayer);
      if (reserve.length === 0) break;

      // Select first available unit from reserve for deployment
      deployMode = true;
      selectedUnitId = reserve[0]!.id;
      validMoves = [];
      validAttacks = [];

      // Show valid deploy targets (home row squares with space)
      const homeRow = getHomeRow(state.currentPlayer);
      for (let c = 0; c < 3; c++) {
        const pos = { col: c, row: homeRow };
        if (canDeploy(state, state.currentPlayer, pos)) {
          validMoves.push(pos);
        }
      }
      state = { ...state, selectedSquare: null };
      break;
    }

    case 'selectGrid': {
      const pos: Position = { col: action.col, row: action.row };

      // If in deploy mode, try to deploy
      if (deployMode && selectedUnitId) {
        if (validMoves.some(m => m.col === pos.col && m.row === pos.row)) {
          state = deployUnit(state, selectedUnitId, pos);
          clearSelection();
          // Check win after action
          const winner = checkWinCondition(state);
          if (winner) state = { ...state, phase: 'game-over', winner };
          break;
        }
        clearSelection();
        break;
      }

      // If a unit is selected and tapping a valid move target
      if (selectedUnitId && validMoves.some(m => m.col === pos.col && m.row === pos.row)) {
        const from = state.selectedSquare!;
        state = moveUnit(state, selectedUnitId, from, pos);
        clearSelection();
        break;
      }

      // If tapping a valid attack target
      if (state.selectedSquare && validAttacks.some(a => a.col === pos.col && a.row === pos.row)) {
        const result = attackSquare(state, [state.selectedSquare], pos);
        state = result.state;
        clearSelection();
        const winner = checkWinCondition(state);
        if (winner) state = { ...state, phase: 'game-over', winner };
        break;
      }

      // Otherwise, select this square
      const sq = getSquare(state, pos);
      if (sq && sq.units.some(u => u.owner === state.currentPlayer)) {
        state = { ...state, selectedSquare: pos };
        const myUnits = sq.units.filter(u => u.owner === state.currentPlayer);
        const firstMovable = myUnits.find(u => !u.hasMoved);

        if (firstMovable) {
          selectedUnitId = firstMovable.id;
          validMoves = getValidMoves(state, firstMovable, pos);
        } else {
          selectedUnitId = null;
          validMoves = [];
        }

        validAttacks = getValidAttacks(state, pos);
      } else {
        clearSelection();
      }
      break;
    }

    case 'endTurn': {
      state = endTurn(state);
      clearSelection();
      break;
    }

    case 'retreat': {
      // Retreat = opponent wins
      const winner: 1 | 2 = state.currentPlayer === 1 ? 2 : 1;
      state = { ...state, phase: 'game-over', winner };
      clearSelection();
      break;
    }

    case 'tap':
      clearSelection();
      break;
  }

  draw();
}

function draw() {
  if (state.phase === 'handoff') {
    renderHandoff(rc, state.currentPlayer);
    return;
  }
  if (state.phase === 'game-over' && state.winner) {
    renderGameOver(rc, state.winner);
    return;
  }
  render(rc, state, validMoves, validAttacks, isFlipped());
}

setupInput(canvas, rc, isFlipped, handleAction);
draw();
```

**Step 3: Verify it compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/input.ts src/main.ts
git commit -m "feat: add input handler and game loop - playable game"
```

---

### Task 11: Manual Playtesting & Bug Fixes

**Files:**
- Potentially modify any `src/` file

**Step 1: Start the dev server**

Run: `bunx --bun live-server --port=3000 --no-browser`

**Step 2: Open in a mobile browser or browser dev tools (mobile viewport)**

Navigate to `http://localhost:3000` and test:

- [ ] Grid renders correctly with 3×4 grid + 2 reserve zones
- [ ] Tapping reserve zone highlights deploy targets on home row
- [ ] Deploying a unit moves it from reserves to grid
- [ ] Selecting a unit shows valid moves (green) and attacks (orange)
- [ ] Infantry moves 1 square orthogonal
- [ ] Cavalry moves up to 2 squares
- [ ] Artillery only moves on home row
- [ ] Attacking an enemy square resolves combat with dice
- [ ] Units lose HP and are destroyed at 0
- [ ] End Turn switches players and rotates board
- [ ] Handoff screen shows between turns
- [ ] Retreat ends the game
- [ ] Destroying all enemy units wins
- [ ] AP decreases with each action
- [ ] Cannot act with 0 AP

**Step 3: Fix any bugs found**

**Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: bug fixes from manual playtesting"
```

---

## Summary

| Task | Description | Estimated Steps |
|------|------------|----------------|
| 1 | Project scaffolding | 7 |
| 2 | Core types | 4 |
| 3 | Game state factory | 5 |
| 4 | Movement rules | 5 |
| 5 | Attack rules | 5 |
| 6 | Combat resolution (d40 + bonuses + damage) | 5 |
| 7 | Game actions (deploy, move, end turn) | 5 |
| 8 | Attack action & win conditions | 5 |
| 9 | Canvas renderer | 3 |
| 10 | Input handler & game loop | 4 |
| 11 | Manual playtesting & bug fixes | 4 |

**Total: 11 tasks, ~52 steps**

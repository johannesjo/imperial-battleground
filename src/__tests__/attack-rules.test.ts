// src/__tests__/attack-rules.test.ts
import { describe, expect, test } from 'bun:test';
import { getValidAttacks } from '../rules';
import { createInitialState, createUnit } from '../game-state';
import type { GameState, Position, Unit } from '../types';
import { SCENARIOS } from '../types';

const BATTLE = SCENARIOS[1]!;

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
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,2');
  });

  test('infantry cannot attack empty squares', () => {
    const inf = createUnit('infantry', 1, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('infantry cannot attack friendly squares', () => {
    const inf1 = createUnit('infantry', 1, 2);
    const inf2 = createUnit('infantry', 1, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf1, { col: 1, row: 1 });
    state = placeUnit(state, inf2, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('artillery can attack any enemy in same column', () => {
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, art, { col: 1, row: 0 }); // home row
    state = placeUnit(state, enemy, { col: 1, row: 3 }); // far end

    const attacks = getValidAttacks(state, { col: 1, row: 0 });
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,3');
  });

  test('artillery cannot attack different column', () => {
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, art, { col: 0, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 0, row: 0 });
    expect(attacks.length).toBe(0);
  });

  test('infantry that already attacked cannot attack again', () => {
    const inf = createUnit('infantry', 1, 2);
    inf.hasAttacked = true;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('infantry that moved this turn cannot attack', () => {
    const inf = createUnit('infantry', 1, 2);
    inf.hasMoved = true;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
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
    let state = createInitialState(BATTLE);
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
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 });
    expect(attacks.length).toBe(0);
  });

  test('artillery that moved cannot fire', () => {
    const art = createUnit('artillery', 1, 2);
    art.hasMoved = true;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 1, row: 0 });
    expect(attacks.length).toBe(0);
  });
});

describe('getValidAttacks with unitId filter', () => {
  test('infantry unitId only shows adjacent targets', () => {
    const inf = createUnit('infantry', 1, 2);
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, art, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 }, inf.id);
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,2');
    // Should NOT include column targets beyond adjacent
    expect(keys).not.toContain('1,3');
    expect(keys).not.toContain('1,0');
  });

  test('artillery unitId only shows column targets', () => {
    const inf = createUnit('infantry', 1, 2);
    const art = createUnit('artillery', 1, 2);
    const enemyNear = createUnit('infantry', 2, 2);
    const enemyFar = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 0 });
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemyNear, { col: 1, row: 1 });
    state = placeUnit(state, enemyFar, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 1, row: 0 }, art.id);
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,1');
    expect(keys).toContain('1,3');
  });

  test('moved infantry filtered by unitId returns empty', () => {
    const inf = createUnit('infantry', 1, 2);
    inf.hasMoved = true;
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 }, inf.id);
    expect(attacks.length).toBe(0);
  });

  test('cavalry moved 1 sq filtered by unitId shows adjacent', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 1;
    const inf = createUnit('infantry', 1, 2);
    inf.hasMoved = true; // infantry can't attack after moving
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 }, cav.id);
    const keys = attacks.map(p => `${p.col},${p.row}`);

    expect(keys).toContain('1,2');
  });

  test('cavalry moved 2 sq filtered by unitId returns empty', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 2;
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const attacks = getValidAttacks(state, { col: 1, row: 1 }, cav.id);
    expect(attacks.length).toBe(0);
  });

  test('without unitId, mixed square shows union of all attack ranges', () => {
    const inf = createUnit('infantry', 1, 2);
    const art = createUnit('artillery', 1, 2);
    const enemyAdj = createUnit('infantry', 2, 2);
    const enemyFar = createUnit('infantry', 2, 2);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 0 });
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemyAdj, { col: 1, row: 1 });
    state = placeUnit(state, enemyFar, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 1, row: 0 });
    const keys = attacks.map(p => `${p.col},${p.row}`);

    // Infantry range (adjacent) + artillery range (column)
    expect(keys).toContain('1,1');
    expect(keys).toContain('1,3');
  });
});

import { describe, expect, test } from 'bun:test';
import { attackSquare, checkWinCondition } from '../actions';
import { createInitialState, createUnit } from '../game-state';
import type { GameState, GridRow, Position, Unit } from '../types';
import { SCENARIOS } from '../types';

const BATTLE = SCENARIOS[1]!;

function placeUnit(state: GameState, unit: Unit, pos: Position): GameState {
  const newGrid = state.grid.map((row, r) =>
    row.map((sq, c) => {
      if (r === pos.row && c === pos.col) {
        return { ...sq, units: [...sq.units, unit] };
      }
      return sq;
    }) as unknown as GridRow
  );
  return { ...state, grid: newGrid };
}

describe('attackSquare', () => {
  test('costs 1 AP', () => {
    const inf = createUnit('infantry', 1, 5);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });
    const apBefore = state.actionPoints;

    const result = attackSquare(state, [{ col: 1, row: 1 }], { col: 1, row: 2 });
    expect(result.state.actionPoints).toBe(apBefore - 1);
  });

  test('marks attacking units as hasAttacked', () => {
    const inf = createUnit('infantry', 1, 5);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(state, [{ col: 1, row: 1 }], { col: 1, row: 2 });
    const attacker = result.state.grid[1]![1]!.units.find(u => u.id === inf.id);
    expect(attacker?.hasAttacked).toBe(true);
  });

  test('destroys unit when HP reaches 0', () => {
    const inf = createUnit('infantry', 1, 5);
    const enemy = createUnit('infantry', 2, 1);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

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
    let state = createInitialState(BATTLE);
    const inf1 = createUnit('infantry', 1, 2);
    const inf2 = createUnit('infantry', 2, 2);
    state = placeUnit(state, inf1, { col: 0, row: 0 });
    state = placeUnit(state, inf2, { col: 0, row: 3 });
    expect(checkWinCondition(state)).toBeNull();
  });

  test('player 1 wins when no P2 units remain anywhere', () => {
    let state = createInitialState(BATTLE);
    state = { ...state, p2Reserve: [] };
    const inf1 = createUnit('infantry', 1, 2);
    state = placeUnit(state, inf1, { col: 0, row: 0 });
    expect(checkWinCondition(state)).toBe(1);
  });

  test('player 2 wins when no P1 units remain anywhere', () => {
    let state = createInitialState(BATTLE);
    state = { ...state, p1Reserve: [] };
    const inf2 = createUnit('infantry', 2, 2);
    state = placeUnit(state, inf2, { col: 0, row: 3 });
    expect(checkWinCondition(state)).toBe(2);
  });
});

describe('attackSquare with unitIds filter', () => {
  test('only specified unit contributes dice', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );

    expect(result.attackResult.totalDice).toBe(3); // infantry level only
  });

  test('only participating unit gets hasAttacked', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );

    const attackerSquare = result.state.grid[1]![1]!;
    const updatedInf = attackerSquare.units.find(u => u.id === inf.id);
    const updatedCav = attackerSquare.units.find(u => u.id === cav.id);
    expect(updatedInf?.hasAttacked).toBe(true);
    expect(updatedCav?.hasAttacked).toBe(false);
  });

  test('non-participating unit can still attack after', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Infantry attacks first
    const first = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );

    // Cavalry can still attack
    const second = attackSquare(
      first.state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [cav.id]
    );

    expect(second.attackResult.totalDice).toBe(2); // cavalry level
  });

  test('two sequential single-unit attacks from same square cost 2 AP', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });
    const apBefore = state.actionPoints;

    const first = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );
    const second = attackSquare(
      first.state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [cav.id]
    );

    expect(second.state.actionPoints).toBe(apBefore - 2);
  });

  test('without unitIds, all eligible units participate', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 }
    );

    expect(result.attackResult.totalDice).toBe(5); // 3 + 2
  });

  test('attacking with 0 AP returns unchanged state', () => {
    const inf = createUnit('infantry', 1, 3);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });
    state = { ...state, actionPoints: 0 };

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );

    expect(result.state.actionPoints).toBe(0);
    expect(result.attackResult.totalDice).toBe(0);
  });
});

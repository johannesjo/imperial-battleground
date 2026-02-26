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

describe('per-unit attack reachability', () => {
  test('cavalry + artillery on same square: only cavalry attacks adjacent off-column target', () => {
    // Cavalry can attack adjacent, artillery can only attack same column
    // Target is adjacent but in a different column → only cavalry should contribute
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 3);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, art, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 0, row: 1 }); // adjacent, different column

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 0, row: 1 },
      [cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(2); // cavalry only
  });

  test('cavalry + artillery on same square: only artillery attacks distant same-column target', () => {
    // Target is in same column but not adjacent → only artillery should contribute
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 3);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 1, row: 0 });
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 }); // same column, 3 rows away

    const result = attackSquare(
      state,
      [{ col: 1, row: 0 }],
      { col: 1, row: 3 },
      [cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(3); // artillery only
  });

  test('cavalry + artillery on same square: both attack adjacent same-column target', () => {
    // Target is adjacent AND in same column → both can contribute
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 3);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, art, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 }); // adjacent AND same column

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(5); // both: 2 + 3
  });

  test('infantry + artillery on same square: only infantry attacks adjacent off-column target', () => {
    const inf = createUnit('infantry', 1, 3);
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, art, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 2, row: 1 }); // adjacent, different column

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 2, row: 1 },
      [inf.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(3); // infantry only
  });

  test('infantry + artillery on same square: only artillery attacks distant same-column target', () => {
    const inf = createUnit('infantry', 1, 3);
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 0 });
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 2 }); // same column, 2 rows away

    const result = attackSquare(
      state,
      [{ col: 1, row: 0 }],
      { col: 1, row: 2 },
      [inf.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(2); // artillery only
  });

  test('infantry + cavalry + artillery: all three attack adjacent same-column target', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 1);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, art, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 }); // adjacent AND same column

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id, cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(6); // all: 3 + 2 + 1
  });

  test('infantry + cavalry + artillery: only melee attacks adjacent off-column target', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 1);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, art, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 0, row: 1 }); // adjacent, different column

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 0, row: 1 },
      [inf.id, cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(5); // inf + cav only: 3 + 2
  });

  test('infantry + cavalry + artillery: only artillery attacks distant same-column target', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 1);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 0 });
    state = placeUnit(state, cav, { col: 1, row: 0 });
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 }); // same column, 3 rows away

    const result = attackSquare(
      state,
      [{ col: 1, row: 0 }],
      { col: 1, row: 3 },
      [inf.id, cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(1); // artillery only
  });

  test('without unitIds filter: only units that can reach target participate', () => {
    // No unitIds means all eligible units, but still filtered by reachability
    const inf = createUnit('infantry', 1, 3);
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 1, row: 0 });
    state = placeUnit(state, art, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 3 }); // distant same-column

    const result = attackSquare(
      state,
      [{ col: 1, row: 0 }],
      { col: 1, row: 3 }
    );

    expect(result.attackResult.totalDice).toBe(2); // artillery only, infantry can't reach
  });

  test('multi-square attack: each unit filtered by reachability from its own square', () => {
    // Cavalry on square A (col 0), artillery on square B (col 1)
    // Target at (1,2): cavalry can reach adjacent, artillery fires in column
    const cav = createUnit('cavalry', 1, 2);
    const art = createUnit('artillery', 1, 3);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, cav, { col: 0, row: 2 }); // adjacent to target
    state = placeUnit(state, art, { col: 1, row: 0 }); // same column as target
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(
      state,
      [{ col: 0, row: 2 }, { col: 1, row: 0 }],
      { col: 1, row: 2 },
      [cav.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(5); // both can reach: 2 + 3
  });

  test('multi-square attack: unreachable units excluded from their square', () => {
    // Infantry on square A (col 0), artillery on square A (col 0)
    // Target at (1,2): infantry can reach adjacent, artillery CANNOT (different column)
    const inf = createUnit('infantry', 1, 3);
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState(BATTLE);
    state = placeUnit(state, inf, { col: 0, row: 2 }); // adjacent to target
    state = placeUnit(state, art, { col: 0, row: 2 }); // same square, wrong column for artillery
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const result = attackSquare(
      state,
      [{ col: 0, row: 2 }],
      { col: 1, row: 2 },
      [inf.id, art.id]
    );

    expect(result.attackResult.totalDice).toBe(3); // infantry only, artillery can't reach
  });
});

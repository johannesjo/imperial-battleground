// src/__tests__/integration.test.ts
import { afterEach, describe, expect, test } from 'bun:test';
import { deployUnit, moveUnit, attackSquare, checkWinCondition } from '../actions';
import { createInitialState, createUnit, getSquare } from '../game-state';
import { getValidAttacks } from '../rules';
import type { GameState, GridRow, Position, Unit } from '../types';
import { BASE_THRESHOLD, BONUS_VALUES } from '../types';

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

const originalRandom = Math.random;

afterEach(() => {
  Math.random = originalRandom;
});

/** Create a mock Math.random that returns values from a queue, then falls back to real random. */
function mockRandom(values: number[]) {
  let i = 0;
  Math.random = () => {
    if (i < values.length) return values[i++]!;
    return originalRandom();
  };
}

/** Convert a desired d40 roll (1-40) to the Math.random() value that produces it.
 *  rollD40Attack does: Math.floor(Math.random() * 40) + 1
 *  So for roll R: Math.random() must return (R - 1) / 40 */
function d40Roll(roll: number): number {
  return (roll - 1) / 40;
}

describe('Conquest of the New World combat scenarios', () => {
  test('infantry deploys, cannot attack same turn', () => {
    let state = createInitialState();
    const inf = state.p1Reserve.find(u => u.type === 'infantry')!;

    // Deploy infantry to home row
    state = deployUnit(state, inf.id, { col: 1, row: 0 });

    // Deployed unit should have hasMoved=true
    const deployed = getSquare(state, { col: 1, row: 0 })!.units.find(
      u => u.id === inf.id
    );
    expect(deployed?.hasMoved).toBe(true);

    // Place an enemy adjacent
    const enemy = createUnit('infantry', 2, 2);
    state = placeUnit(state, enemy, { col: 1, row: 1 });

    // Deployed infantry should not be able to attack
    const attacks = getValidAttacks(state, { col: 1, row: 0 }, inf.id);
    expect(attacks.length).toBe(0);
  });

  test('cavalry charge: move 1, attack with +6 bonus', () => {
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    state = placeUnit(state, cav, { col: 1, row: 0 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Move cavalry 1 square forward
    state = moveUnit(state, cav.id, { col: 1, row: 0 }, { col: 1, row: 1 });

    // Verify cavalry can still attack (charge)
    const attacks = getValidAttacks(state, { col: 1, row: 1 }, cav.id);
    expect(attacks.some(a => a.col === 1 && a.row === 2)).toBe(true);

    // Mock dice to always hit (roll 1, well under any threshold)
    mockRandom([d40Roll(1), d40Roll(1)]);

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [cav.id]
    );

    // Should have cavalry-charge bonus
    expect(result.attackResult.bonuses).toContain('cavalry-charge');
    // Threshold = base 6 + cavalry-charge 6 = 12
    expect(result.attackResult.threshold).toBe(
      BASE_THRESHOLD + BONUS_VALUES['cavalry-charge']
    );
  });

  test('selective attack preserves other units', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Attack with infantry only
    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );

    const sq = result.state.grid[1]![1]!;
    const updatedCav = sq.units.find(u => u.id === cav.id);
    expect(updatedCav?.hasAttacked).toBe(false);
    expect(updatedCav?.hasMoved).toBe(false);
  });

  test('combined arms only when attacking with multiple types simultaneously', () => {
    const inf = createUnit('infantry', 1, 3);
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, cav, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Single-unit attack: no combined arms
    mockRandom([d40Roll(1), d40Roll(1), d40Roll(1)]);
    const single = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );
    expect(single.attackResult.bonuses).not.toContain('combined-arms-2');

    // Multi-unit attack: combined arms
    mockRandom([d40Roll(1), d40Roll(1), d40Roll(1), d40Roll(1), d40Roll(1)]);
    const multi = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 }
    );
    expect(multi.attackResult.bonuses).toContain('combined-arms-2');
  });

  test('artillery fires entire column', () => {
    const art = createUnit('artillery', 1, 2);
    const enemyFar = createUnit('infantry', 2, 2);
    let state = createInitialState();
    // Artillery on P1 home row
    state = placeUnit(state, art, { col: 1, row: 0 });
    // Enemy 3 rows away
    state = placeUnit(state, enemyFar, { col: 1, row: 3 });

    const attacks = getValidAttacks(state, { col: 1, row: 0 }, art.id);
    expect(attacks.some(a => a.col === 1 && a.row === 3)).toBe(true);

    // Mock dice to guarantee hits
    mockRandom([d40Roll(1), d40Roll(1)]);
    const result = attackSquare(
      state,
      [{ col: 1, row: 0 }],
      { col: 1, row: 3 },
      [art.id]
    );
    expect(result.attackResult.hits).toBe(2);
  });

  test('destroying last enemy triggers win', () => {
    const inf = createUnit('infantry', 1, 5);
    const enemy = createUnit('infantry', 2, 1); // 1 HP, easy to destroy
    let state = createInitialState();
    state = { ...state, p1Reserve: [], p2Reserve: [] };
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Mock dice: guaranteed hit (roll 1 <= threshold 6)
    mockRandom([d40Roll(1), d40Roll(1), d40Roll(1), d40Roll(1), d40Roll(1)]);

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );

    const winner = checkWinCondition(result.state);
    expect(winner).toBe(1);
  });

  test('d40 base hit rate: threshold 10 means roll 1-10 hits', () => {
    // Roll exactly 10 should hit (roll <= threshold)
    mockRandom([d40Roll(10)]);
    const inf = createUnit('infantry', 1, 1);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const hitResult = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );
    expect(hitResult.attackResult.hits).toBe(1);

    // Roll exactly 11 should miss
    mockRandom([d40Roll(11)]);
    const missResult = attackSquare(
      state,
      [{ col: 1, row: 1 }],
      { col: 1, row: 2 },
      [inf.id]
    );
    expect(missResult.attackResult.hits).toBe(0);
  });

  test('bonus stacking: combined arms + flanking + charge', () => {
    // Setup: cavalry charged from one square, infantry+artillery in another
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 1;
    const inf = createUnit('infantry', 1, 2);
    const art = createUnit('artillery', 1, 2);
    const enemy = createUnit('infantry', 2, 5);
    let state = createInitialState();
    // Cav in square adjacent to enemy
    state = placeUnit(state, cav, { col: 1, row: 1 });
    // Inf + Art in another square adjacent to enemy
    state = placeUnit(state, inf, { col: 0, row: 2 });
    state = placeUnit(state, art, { col: 0, row: 2 });
    // Enemy at target
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    // Mock all dice to hit
    mockRandom(Array(6).fill(d40Roll(1)));

    const result = attackSquare(
      state,
      [{ col: 1, row: 1 }, { col: 0, row: 2 }],
      { col: 1, row: 2 }
    );

    // 3 types across all squares: combined-arms-3 (+8)
    expect(result.attackResult.bonuses).toContain('combined-arms-3');
    // 2 attacking columns: flanking-2 (+4)
    expect(result.attackResult.bonuses).toContain('flanking-2');
    // Cavalry moved 1 square: cavalry-charge (+6)
    expect(result.attackResult.bonuses).toContain('cavalry-charge');

    // Threshold: 10 + 10 + 10 + 6 = 36
    const expectedThreshold = BASE_THRESHOLD +
      BONUS_VALUES['combined-arms-3'] +
      BONUS_VALUES['flanking-2'] +
      BONUS_VALUES['cavalry-charge'];
    expect(result.attackResult.threshold).toBe(expectedThreshold);
    expect(expectedThreshold).toBe(36);
  });
});

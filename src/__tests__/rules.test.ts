// src/__tests__/rules.test.ts
import { describe, expect, test } from 'bun:test';
import { getValidMoves, canDeploy } from '../rules';
import { createInitialState, createUnit, getSquare } from '../game-state';
import type { GameState, Position, Unit } from '../types';

/** Place a unit on the grid and return updated state */
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

  test('units cannot move to squares at max unit count', () => {
    let state = createInitialState();
    // Fill a square with 3 units (max)
    for (let i = 0; i < 3; i++) {
      state = placeUnit(state, createUnit('infantry', 1, 2), { col: 1, row: 0 });
    }
    // Try to move another infantry adjacent
    const inf = createUnit('infantry', 1, 2);
    state = placeUnit(state, inf, { col: 0, row: 0 });

    const moves = getValidMoves(state, inf, { col: 0, row: 0 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    expect(moveKeys).not.toContain('1,0'); // full square
  });

  test('infantry cannot move onto square with enemy units', () => {
    const inf = createUnit('infantry', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, inf, { col: 1, row: 1 });
    state = placeUnit(state, enemy, { col: 1, row: 2 });

    const moves = getValidMoves(state, inf, { col: 1, row: 1 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    expect(moveKeys).not.toContain('1,2');
  });

  test('cavalry cannot pass through enemy-occupied square', () => {
    const cav = createUnit('cavalry', 1, 2);
    const enemy = createUnit('infantry', 2, 2);
    let state = createInitialState();
    state = placeUnit(state, cav, { col: 0, row: 0 });
    // Place enemy on the intermediate square
    state = placeUnit(state, enemy, { col: 1, row: 0 });

    const moves = getValidMoves(state, cav, { col: 0, row: 0 });
    const moveKeys = moves.map(p => `${p.col},${p.row}`);

    // Can't reach (2,0) straight through enemy, and L-shapes through (1,0) also blocked
    expect(moveKeys).not.toContain('2,0');
    // But can still move to (0,1) directly
    expect(moveKeys).toContain('0,1');
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

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
    expect(state.p1Reserve.length).toBe(7);
    expect(state.p2Reserve.length).toBe(7);

    const countTypes = (units: typeof state.p1Reserve) => ({
      infantry: units.filter(u => u.type === 'infantry').length,
      cavalry: units.filter(u => u.type === 'cavalry').length,
      artillery: units.filter(u => u.type === 'artillery').length,
    });

    expect(countTypes(state.p1Reserve)).toEqual({ infantry: 3, cavalry: 2, artillery: 2 });
    expect(countTypes(state.p2Reserve)).toEqual({ infantry: 3, cavalry: 2, artillery: 2 });
  });

  test('units start at level 2 or 3', () => {
    const state = createInitialState();
    [...state.p1Reserve, ...state.p2Reserve].forEach(u => {
      expect(u.level).toBeGreaterThanOrEqual(2);
      expect(u.level).toBeLessThanOrEqual(3);
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

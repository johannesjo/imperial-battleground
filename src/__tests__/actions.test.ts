import { describe, expect, test } from 'bun:test';
import { deployUnit, moveUnit, endTurn } from '../actions';
import { createInitialState } from '../game-state';

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

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
    expect(BASE_THRESHOLD).toBe(10);
    expect(D40).toBe(40);
  });

  test('infantry costs 1 slot, cavalry and artillery cost 2', () => {
    expect(UNIT_STACK_COST.infantry).toBe(1);
    expect(UNIT_STACK_COST.cavalry).toBe(2);
    expect(UNIT_STACK_COST.artillery).toBe(2);
  });

  test('bonus values match original game', () => {
    expect(BONUS_VALUES['combined-arms-2']).toBe(6);
    expect(BONUS_VALUES['combined-arms-3']).toBe(10);
    expect(BONUS_VALUES['flanking-2']).toBe(10);
    expect(BONUS_VALUES['flanking-3']).toBe(20);
    expect(BONUS_VALUES['cavalry-charge']).toBe(6);
  });
});

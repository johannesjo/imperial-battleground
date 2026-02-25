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
    expect(calculateThreshold([
      'combined-arms-3', 'flanking-4', 'cavalry-charge',
    ])).toBeLessThanOrEqual(MAX_THRESHOLD);
  });
});

describe('rollD40Attack', () => {
  test('returns number of hits between 0 and totalDice', () => {
    for (let i = 0; i < 100; i++) {
      const hits = rollD40Attack(10, 20);
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
      createUnit('infantry', 2, 1),
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

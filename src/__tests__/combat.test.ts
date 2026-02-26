// src/__tests__/combat.test.ts
import { describe, expect, test } from 'bun:test';
import {
  calculateBonuses,
  calculateThreshold,
  getArtilleryThreshold,
  rollD40Attack,
  distributeDamage,
} from '../combat';
import { createUnit } from '../game-state';
import type { Unit, Position } from '../types';
import { BASE_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD, ARTILLERY_THRESHOLDS, D40 } from '../types';

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

  test('flanking 2 for attacks from 2 columns', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('0,1', [createUnit('infantry', 1, 2)]);
    attackers.set('1,0', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('flanking-2');
  });

  test('flanking 3 for attacks from 3 columns', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('0,1', [createUnit('infantry', 1, 2)]);
    attackers.set('1,0', [createUnit('infantry', 1, 2)]);
    attackers.set('2,1', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('flanking-3');
  });

  test('no flanking for 2 squares in the same column', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,0', [createUnit('infantry', 1, 2)]);
    attackers.set('1,2', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).not.toContain('flanking-2');
    expect(bonuses).not.toContain('flanking-3');
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
    expect(calculateThreshold(['combined-arms-2'])).toBe(BASE_THRESHOLD + 6);
    expect(calculateThreshold(['cavalry-charge'])).toBe(BASE_THRESHOLD + 6);
  });

  test('stacks multiple bonuses (clamped to max)', () => {
    expect(calculateThreshold(['combined-arms-3', 'flanking-3', 'cavalry-charge']))
      .toBe(MAX_THRESHOLD); // 10+10+20+6 = 46, clamped to 36
  });

  test('clamps to minimum 2', () => {
    expect(calculateThreshold([])).toBeGreaterThanOrEqual(MIN_THRESHOLD);
  });

  test('clamps to maximum 36 (90%)', () => {
    expect(calculateThreshold([
      'combined-arms-3', 'flanking-3', 'cavalry-charge',
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
  test('total damage equals total hits', () => {
    const attackers = [createUnit('infantry', 1, 3)];
    const defenders = [
      createUnit('infantry', 2, 3),
      createUnit('cavalry', 2, 3),
    ];
    const result = distributeDamage(4, attackers, defenders);
    const totalDmg = result.reduce((sum, r) => sum + r.damage, 0);
    expect(totalDmg).toBe(4);
  });

  test('damage spreads across multiple defenders', () => {
    const attackers = [createUnit('infantry', 1, 3)];
    const defenders = [
      createUnit('infantry', 2, 3),
      createUnit('cavalry', 2, 3),
    ];
    // With 6 hits across 2 defenders, both should be hit most of the time
    let bothHit = 0;
    for (let i = 0; i < 50; i++) {
      const result = distributeDamage(6, attackers, defenders);
      if (result.length >= 2) bothHit++;
    }
    expect(bothHit).toBeGreaterThan(40); // almost always hits both
  });

  test('destroyed units stop taking damage', () => {
    const attackers = [createUnit('infantry', 1, 3)];
    const defenders = [
      createUnit('infantry', 2, 1),
      createUnit('cavalry', 2, 5),
    ];
    const result = distributeDamage(4, attackers, defenders);
    const infDmg = result.find(r => r.unitId === defenders[0]!.id);
    // Infantry has 1 HP, should take at most 1 damage
    if (infDmg) {
      expect(infDmg.damage).toBeLessThanOrEqual(1);
      expect(infDmg.destroyed).toBe(true);
    }
    const totalDmg = result.reduce((sum, r) => sum + r.damage, 0);
    expect(totalDmg).toBe(4);
  });

  test('excess damage beyond all defender HP is lost', () => {
    const attackers = [createUnit('infantry', 1, 5)];
    const defenders = [createUnit('infantry', 2, 2)];
    const result = distributeDamage(5, attackers, defenders);
    expect(result[0]!.damage).toBe(2);
    expect(result[0]!.destroyed).toBe(true);
  });
});

describe('combined arms with selective attackers', () => {
  test('single unit type yields no combined arms', () => {
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);
    const hasCombinedArms = bonuses.some(b => b.startsWith('combined-arms'));
    expect(hasCombinedArms).toBe(false);
  });

  test('cavalry charge applies with single cavalry', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 1;
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [cav]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).toContain('cavalry-charge');
    expect(bonuses).not.toContain('combined-arms-2');
    expect(bonuses).not.toContain('combined-arms-3');
  });

  test('all bonuses stack: combined-arms-3 + flanking-2 + cavalry-charge', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 1;
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [
      createUnit('infantry', 1, 2),
      cav,
      createUnit('artillery', 1, 2),
    ]);
    attackers.set('0,1', [createUnit('infantry', 1, 2)]);
    const bonuses = calculateBonuses(attackers);

    expect(bonuses).toContain('combined-arms-3');
    expect(bonuses).toContain('flanking-2');
    expect(bonuses).toContain('cavalry-charge');

    const threshold = calculateThreshold(bonuses);
    expect(threshold).toBe(MAX_THRESHOLD); // 10+10+10+6 = 36 = MAX_THRESHOLD
  });

  test('no cavalry charge when cavalry moved 2 squares', () => {
    const cav = createUnit('cavalry', 1, 2);
    cav.hasMoved = true;
    cav.movedSquares = 2;
    const attackers = new Map<string, Unit[]>();
    attackers.set('1,1', [cav]);
    const bonuses = calculateBonuses(attackers);
    expect(bonuses).not.toContain('cavalry-charge');
  });
});

describe('getArtilleryThreshold', () => {
  test('distance 1 (adjacent): 15% hit rate', () => {
    expect(getArtilleryThreshold(1)).toBe(6);
    expect(getArtilleryThreshold(1) / D40).toBeCloseTo(0.15);
  });

  test('distance 2: 50% hit rate', () => {
    expect(getArtilleryThreshold(2)).toBe(20);
    expect(getArtilleryThreshold(2) / D40).toBeCloseTo(0.5);
  });

  test('distance 3: 15% hit rate', () => {
    expect(getArtilleryThreshold(3)).toBe(6);
    expect(getArtilleryThreshold(3) / D40).toBeCloseTo(0.15);
  });

  test('distance 0 or invalid returns 0', () => {
    expect(getArtilleryThreshold(0)).toBe(0);
    expect(getArtilleryThreshold(4)).toBe(0);
  });
});

// src/combat.ts
import type { Unit, BonusType } from './types';
import { BASE_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD, D40, BONUS_VALUES, ARTILLERY_THRESHOLDS } from './types';

/** Determine which combat bonuses apply based on attacking units grouped by source square. */
export function calculateBonuses(attackersBySquare: Map<string, Unit[]>): BonusType[] {
  const bonuses: BonusType[] = [];
  const allAttackers = [...attackersBySquare.values()].flat();

  // Combined arms: count distinct unit types across all attacking squares
  const types = new Set(allAttackers.map(u => u.type));
  if (types.size >= 3) {
    bonuses.push('combined-arms-3');
  } else if (types.size === 2) {
    bonuses.push('combined-arms-2');
  }

  // Flanking: count distinct columns attacking from
  const cols = new Set([...attackersBySquare.keys()].map(k => k.split(',')[0]));
  if (cols.size >= 3) {
    bonuses.push('flanking-3');
  } else if (cols.size >= 2) {
    bonuses.push('flanking-2');
  }

  // Cavalry charge: any cavalry that moved exactly 1 square this turn
  const hasChargingCav = allAttackers.some(
    u => u.type === 'cavalry' && u.hasMoved && u.movedSquares === 1
  );
  if (hasChargingCav) {
    bonuses.push('cavalry-charge');
  }

  return bonuses;
}

/** Calculate the hit threshold from base + bonuses, clamped to [MIN_THRESHOLD, MAX_THRESHOLD]. */
export function calculateThreshold(bonuses: BonusType[]): number {
  const bonusTotal = bonuses.reduce((sum, b) => sum + BONUS_VALUES[b], 0);
  const raw = BASE_THRESHOLD + bonusTotal;
  return Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, raw));
}

/** Get artillery hit threshold based on distance to target. */
export function getArtilleryThreshold(distance: number): number {
  return ARTILLERY_THRESHOLDS[distance] ?? 0;
}

/** Roll totalDice d40s and count hits (roll <= threshold). */
export function rollD40Attack(totalDice: number, threshold: number): number {
  let hits = 0;
  for (let i = 0; i < totalDice; i++) {
    const roll = Math.floor(Math.random() * D40) + 1; // 1-40
    if (roll <= threshold) {
      hits++;
    }
  }
  return hits;
}

/** Distribute damage randomly across defenders. Each hit targets a random surviving unit. */
export function distributeDamage(
  totalHits: number,
  _attackers: Unit[],
  defenders: Unit[]
): Array<{ unitId: string; damage: number; destroyed: boolean }> {
  const defenderState = defenders.map(d => ({ id: d.id, remainingHp: d.level, totalDmg: 0 }));

  for (let i = 0; i < totalHits; i++) {
    const alive = defenderState.filter(d => d.remainingHp > 0);
    if (alive.length === 0) break;
    const target = alive[Math.floor(Math.random() * alive.length)]!;
    target.remainingHp -= 1;
    target.totalDmg += 1;
  }

  return defenderState
    .filter(d => d.totalDmg > 0)
    .map(d => ({
      unitId: d.id,
      damage: d.totalDmg,
      destroyed: d.remainingHp <= 0,
    }));
}

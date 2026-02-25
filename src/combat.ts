// src/combat.ts
import type { Unit, BonusType } from './types';
import { BASE_THRESHOLD, MIN_THRESHOLD, MAX_THRESHOLD, D40, BONUS_VALUES } from './types';

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

  // Flanking: count distinct squares attacking
  const squareCount = attackersBySquare.size;
  if (squareCount >= 4) {
    bonuses.push('flanking-4');
  } else if (squareCount >= 3) {
    bonuses.push('flanking-3');
  } else if (squareCount >= 2) {
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

/** Distribute damage using like-hits-like priority, with overflow spilling to other types. */
export function distributeDamage(
  totalHits: number,
  attackers: Unit[],
  defenders: Unit[]
): Array<{ unitId: string; damage: number; destroyed: boolean }> {
  const result: Array<{ unitId: string; damage: number; destroyed: boolean }> = [];
  const defenderState = defenders.map(d => ({ ...d, remainingHp: d.level }));
  let hitsLeft = totalHits;

  // Get attacker types for like-hits-like priority
  const attackerTypes = new Set(attackers.map(u => u.type));

  // First pass: like-hits-like
  for (const attackerType of attackerTypes) {
    const matchingDefenders = defenderState.filter(
      d => d.type === attackerType && d.remainingHp > 0
    );
    for (const def of matchingDefenders) {
      if (hitsLeft <= 0) break;
      const dmg = Math.min(hitsLeft, def.remainingHp);
      def.remainingHp -= dmg;
      hitsLeft -= dmg;
      result.push({
        unitId: def.id,
        damage: dmg,
        destroyed: def.remainingHp <= 0,
      });
    }
  }

  // Second pass: spill over to remaining defenders
  if (hitsLeft > 0) {
    const remaining = defenderState.filter(d => d.remainingHp > 0);
    for (const def of remaining) {
      if (hitsLeft <= 0) break;
      const dmg = Math.min(hitsLeft, def.remainingHp);
      def.remainingHp -= dmg;
      hitsLeft -= dmg;
      const existing = result.find(r => r.unitId === def.id);
      if (existing) {
        existing.damage += dmg;
        existing.destroyed = def.remainingHp <= 0;
      } else {
        result.push({
          unitId: def.id,
          damage: dmg,
          destroyed: def.remainingHp <= 0,
        });
      }
    }
  }

  return result;
}

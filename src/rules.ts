// src/rules.ts
import type { GameState, Position, Unit, Player } from './types';
import { GRID_COLS, GRID_ROWS, MAX_UNITS_PER_SQUARE } from './types';
import { getSquare, getHomeRow } from './game-state';

function isInBounds(pos: Position): boolean {
  return pos.col >= 0 && pos.col < GRID_COLS && pos.row >= 0 && pos.row < GRID_ROWS;
}

function canFitInSquare(state: GameState, pos: Position, unit: Unit): boolean {
  const sq = getSquare(state, pos);
  if (!sq) return false;
  if (sq.units.length > 0 && sq.units[0]!.owner !== unit.owner) return false;
  return sq.units.length < MAX_UNITS_PER_SQUARE;
}

const ORTHOGONAL: readonly Position[] = [
  { col: 0, row: -1 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
  { col: 1, row: 0 },
];

/** Returns all valid positions a unit can move to from its current position */
export function getValidMoves(state: GameState, unit: Unit, from: Position): Position[] {
  if (unit.hasMoved) return [];

  const moves: Position[] = [];
  const homeRow = getHomeRow(unit.owner);

  if (unit.type === 'artillery') {
    // Artillery: 1 square, home row only
    for (const dir of ORTHOGONAL) {
      const to: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(to) && to.row === homeRow && canFitInSquare(state, to, unit)) {
        moves.push(to);
      }
    }
    return moves;
  }

  // Infantry: 1 square orthogonal
  if (unit.type === 'infantry') {
    for (const dir of ORTHOGONAL) {
      const to: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(to) && canFitInSquare(state, to, unit)) {
        moves.push(to);
      }
    }
    return moves;
  }

  // Cavalry: up to 2 squares orthogonal, can change direction
  if (unit.type === 'cavalry') {
    for (const dir of ORTHOGONAL) {
      const step1: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(step1) && canFitInSquare(state, step1, unit)) {
        moves.push(step1);
        // Second step in same direction
        const step2: Position = { col: step1.col + dir.col, row: step1.row + dir.row };
        if (isInBounds(step2) && canFitInSquare(state, step2, unit)) {
          moves.push(step2);
        }
      }
      // L-shaped 2-square moves (change direction after first step)
      if (isInBounds(step1) && !hasEnemyUnits(state, step1, unit.owner)) {
        for (const dir2 of ORTHOGONAL) {
          if (dir2.col === -dir.col && dir2.row === -dir.row) continue; // no backtracking
          if (dir2.col === dir.col && dir2.row === dir.row) continue; // already handled
          const step2: Position = { col: step1.col + dir2.col, row: step1.row + dir2.row };
          if (
            isInBounds(step2) &&
            canFitInSquare(state, step2, unit) &&
            !(step2.col === from.col && step2.row === from.row) // no returning to start
          ) {
            // Avoid duplicates
            if (!moves.some(m => m.col === step2.col && m.row === step2.row)) {
              moves.push(step2);
            }
          }
        }
      }
    }
    return moves;
  }

  return moves;
}

/** Returns valid 1-square orthogonal positions where all units can move together.
 *  Artillery cannot participate. All units must not have moved yet. */
export function getValidGroupMoves(state: GameState, units: Unit[], from: Position): Position[] {
  if (units.length < 2) return [];
  if (units.some(u => u.hasMoved || u.type === 'artillery')) return [];

  const owner = units[0]!.owner;
  const moves: Position[] = [];

  for (const dir of ORTHOGONAL) {
    const to: Position = { col: from.col + dir.col, row: from.row + dir.row };
    if (!isInBounds(to)) continue;
    const sq = getSquare(state, to);
    if (!sq) continue;
    if (sq.units.length > 0 && sq.units[0]!.owner !== owner) continue;
    if (sq.units.length + units.length > MAX_UNITS_PER_SQUARE) continue;
    moves.push(to);
  }

  return moves;
}

/** Checks whether a player can deploy a unit to the given position */
export function canDeploy(state: GameState, player: Player, target: Position): boolean {
  const homeRow = getHomeRow(player);
  if (target.row !== homeRow) return false;
  if (!isInBounds(target)) return false;
  const sq = getSquare(state, target);
  if (!sq) return false;
  return sq.units.length < MAX_UNITS_PER_SQUARE;
}

function canUnitAttack(unit: Unit): boolean {
  if (unit.hasAttacked) return false;
  if (unit.type === 'infantry' && unit.hasMoved) return false;
  if (unit.type === 'artillery' && unit.hasMoved) return false;
  if (unit.type === 'cavalry' && unit.hasMoved && unit.movedSquares > 1) return false;
  return true;
}

function hasEnemyUnits(state: GameState, pos: Position, attackerOwner: Player): boolean {
  const sq = getSquare(state, pos);
  if (!sq) return false;
  return sq.units.some(u => u.owner !== attackerOwner);
}

/** Returns all valid positions that units at `from` can attack.
 *  If unitId is provided, only considers that specific unit. */
export function getValidAttacks(state: GameState, from: Position, unitId?: string): Position[] {
  const sq = getSquare(state, from);
  if (!sq) return [];

  let attackers = sq.units.filter(u => canUnitAttack(u));
  if (unitId) {
    attackers = attackers.filter(u => u.id === unitId);
  }
  if (attackers.length === 0) return [];

  const owner = attackers[0]!.owner;
  const targets: Position[] = [];

  const hasAdjacentAttacker = attackers.some(u => u.type === 'infantry' || u.type === 'cavalry');
  const hasArtillery = attackers.some(u => u.type === 'artillery');

  if (hasAdjacentAttacker) {
    for (const dir of ORTHOGONAL) {
      const target: Position = { col: from.col + dir.col, row: from.row + dir.row };
      if (isInBounds(target) && hasEnemyUnits(state, target, owner)) {
        targets.push(target);
      }
    }
  }

  if (hasArtillery) {
    for (let r = 0; r < GRID_ROWS; r++) {
      if (r === from.row) continue;
      const target: Position = { col: from.col, row: r };
      if (hasEnemyUnits(state, target, owner) && !targets.some(t => t.col === target.col && t.row === target.row)) {
        targets.push(target);
      }
    }
  }

  return targets;
}

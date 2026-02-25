// src/rules.ts
import type { GameState, Position, Unit, Player } from './types';
import { GRID_COLS, GRID_ROWS, MAX_STACK_SLOTS, UNIT_STACK_COST } from './types';
import { getSquare, getHomeRow } from './game-state';

function isInBounds(pos: Position): boolean {
  return pos.col >= 0 && pos.col < GRID_COLS && pos.row >= 0 && pos.row < GRID_ROWS;
}

function stackUsed(units: Unit[]): number {
  return units.reduce((sum, u) => sum + UNIT_STACK_COST[u.type], 0);
}

function canFitInSquare(state: GameState, pos: Position, unit: Unit): boolean {
  const sq = getSquare(state, pos);
  if (!sq) return false;
  return stackUsed(sq.units) + UNIT_STACK_COST[unit.type] <= MAX_STACK_SLOTS;
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
      if (isInBounds(step1)) {
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

/** Checks whether a player can deploy a unit to the given position */
export function canDeploy(state: GameState, player: Player, target: Position): boolean {
  const homeRow = getHomeRow(player);
  if (target.row !== homeRow) return false;
  if (!isInBounds(target)) return false;
  const sq = getSquare(state, target);
  if (!sq) return false;
  return stackUsed(sq.units) < MAX_STACK_SLOTS;
}

// src/actions.ts
import type { AttackResult, GameState, GridRow, Player, Position, Unit } from './types';
import { calculateBonuses, calculateThreshold, rollD40Attack, distributeDamage } from './combat';
import { getSquare, getHomeRow, getReserve } from './game-state';
import { getValidAttacks } from './rules';

function mapGrid(
  state: GameState,
  fn: (sq: GridRow[number], col: number, row: number) => GridRow[number]
): readonly GridRow[] {
  return state.grid.map((gridRow, r) =>
    gridRow.map((sq, c) => fn(sq, c, r)) as unknown as GridRow
  );
}

function addUnitToSquare(state: GameState, pos: Position, unit: Unit): GameState {
  const grid = mapGrid(state, (sq, c, r) => {
    if (r === pos.row && c === pos.col) {
      return { ...sq, units: [...sq.units, unit] };
    }
    return sq;
  });
  return { ...state, grid };
}

function removeUnitFromSquare(state: GameState, pos: Position, unitId: string): GameState {
  const grid = mapGrid(state, (sq, c, r) => {
    if (r === pos.row && c === pos.col) {
      return { ...sq, units: sq.units.filter(u => u.id !== unitId) };
    }
    return sq;
  });
  return { ...state, grid };
}

/** Deploy a unit from the current player's reserve to their home row. Costs 1 AP. */
export function deployUnit(state: GameState, unitId: string, target: Position): GameState {
  if (state.actionPoints <= 0) return state;

  const reserve = getReserve(state, state.currentPlayer);
  const unit = reserve.find(u => u.id === unitId);
  if (!unit) return state;

  const homeRow = getHomeRow(state.currentPlayer);
  if (target.row !== homeRow) return state;

  const deployed: Unit = { ...unit, hasMoved: true, movedSquares: 0 };

  let newState = addUnitToSquare(state, target, deployed);
  const newReserve = reserve.filter(u => u.id !== unitId);

  if (state.currentPlayer === 1) {
    newState = { ...newState, p1Reserve: newReserve };
  } else {
    newState = { ...newState, p2Reserve: newReserve };
  }

  return { ...newState, actionPoints: state.actionPoints - 1 };
}

/** Move a unit from one grid square to another. Costs 1 AP. */
export function moveUnit(
  state: GameState,
  unitId: string,
  from: Position,
  to: Position
): GameState {
  if (state.actionPoints <= 0) return state;

  const sq = getSquare(state, from);
  if (!sq) return state;

  const unit = sq.units.find(u => u.id === unitId);
  if (!unit) return state;

  const distance = Math.abs(to.col - from.col) + Math.abs(to.row - from.row);
  const movedUnit: Unit = { ...unit, hasMoved: true, movedSquares: distance };

  let newState = removeUnitFromSquare(state, from, unitId);
  newState = addUnitToSquare(newState, to, movedUnit);

  return { ...newState, actionPoints: state.actionPoints - 1 };
}

/** Move multiple units together from one square to another. Costs 1 AP. */
export function moveUnits(
  state: GameState,
  unitIds: string[],
  from: Position,
  to: Position
): GameState {
  if (state.actionPoints <= 0) return state;
  if (unitIds.length === 0) return state;

  const sq = getSquare(state, from);
  if (!sq) return state;

  const units = unitIds.map(id => sq.units.find(u => u.id === id)).filter((u): u is Unit => !!u);
  if (units.length !== unitIds.length) return state;

  const distance = Math.abs(to.col - from.col) + Math.abs(to.row - from.row);
  let newState = state;
  for (const unit of units) {
    const movedUnit: Unit = { ...unit, hasMoved: true, movedSquares: distance };
    newState = removeUnitFromSquare(newState, from, unit.id);
    newState = addUnitToSquare(newState, to, movedUnit);
  }

  return { ...newState, actionPoints: state.actionPoints - 1 };
}

function resetPlayerUnits(state: GameState, player: Player): GameState {
  const grid = mapGrid(state, (sq) => ({
    ...sq,
    units: sq.units.map(u =>
      u.owner === player
        ? { ...u, hasMoved: false, hasAttacked: false, movedSquares: 0 }
        : u
    ),
  }));
  return { ...state, grid };
}

/** End the current player's turn. Resets next player's unit flags, switches player. */
export function endTurn(state: GameState): GameState {
  const nextPlayer: Player = state.currentPlayer === 1 ? 2 : 1;
  const nextTurn = nextPlayer === 1 ? state.turnNumber + 1 : state.turnNumber;

  const newState = resetPlayerUnits(state, nextPlayer);

  return {
    ...newState,
    currentPlayer: nextPlayer,
    actionPoints: state.maxActionPoints,
    selectedSquare: null,
    phase: 'handoff',
    turnNumber: nextTurn,
  };
}

/** Confirm the handoff screen and resume play. */
export function confirmHandoff(state: GameState): GameState {
  return { ...state, phase: 'playing' };
}

function emptyResult(fromSquares: Position[], target: Position): AttackResult {
  return {
    attackerSquares: fromSquares,
    targetSquare: target,
    totalDice: 0,
    threshold: 0,
    hits: 0,
    bonuses: [],
    unitDamage: [],
  };
}

/** Attack a target square from one or more source squares. Costs 1 AP.
 *  If unitIds is provided, only those specific units participate. */
export function attackSquare(
  state: GameState,
  fromSquares: Position[],
  target: Position,
  unitIds?: string[]
): { state: GameState; attackResult: AttackResult } {
  if (state.actionPoints <= 0) {
    return { state, attackResult: emptyResult(fromSquares, target) };
  }

  // Gather eligible attackers, only from squares that can actually reach the target
  const attackersBySquare = new Map<string, Unit[]>();
  const allAttackers: Unit[] = [];

  for (const from of fromSquares) {
    const reachable = getValidAttacks(state, from);
    if (!reachable.some(t => t.col === target.col && t.row === target.row)) continue;

    const sq = getSquare(state, from);
    if (!sq) continue;
    const key = `${from.col},${from.row}`;
    let eligible = sq.units.filter(
      u => u.owner === state.currentPlayer && !u.hasAttacked
    );
    if (unitIds) {
      eligible = eligible.filter(u => unitIds.includes(u.id));
    }
    if (eligible.length > 0) {
      attackersBySquare.set(key, eligible);
      allAttackers.push(...eligible);
    }
  }

  // Get defenders
  const targetSq = getSquare(state, target);
  if (!targetSq) return { state, attackResult: emptyResult(fromSquares, target) };
  const defenders = targetSq.units.filter(u => u.owner !== state.currentPlayer);
  if (defenders.length === 0) return { state, attackResult: emptyResult(fromSquares, target) };

  // Calculate bonuses, threshold, dice, and hits
  const bonuses = calculateBonuses(attackersBySquare);
  const threshold = calculateThreshold(bonuses);
  const totalDice = allAttackers.reduce((sum, u) => sum + u.level, 0);
  const hits = rollD40Attack(totalDice, threshold);

  // Distribute damage among defenders
  const unitDamage = distributeDamage(hits, allAttackers, defenders);

  // Mark only participating attackers as hasAttacked
  const attackerIds = new Set(allAttackers.map(u => u.id));
  let newState: GameState = {
    ...state,
    grid: mapGrid(state, (sq, c, r) => {
      const isAttackerSquare = fromSquares.some(f => f.row === r && f.col === c);
      if (!isAttackerSquare) return sq;
      return {
        ...sq,
        units: sq.units.map(u =>
          attackerIds.has(u.id) ? { ...u, hasAttacked: true } : u
        ),
      };
    }),
  };

  // Apply damage to defenders, removing destroyed units
  newState = {
    ...newState,
    grid: mapGrid(newState, (sq, c, r) => {
      if (r !== target.row || c !== target.col) return sq;
      const updatedUnits = sq.units
        .map(u => {
          const dmgEntry = unitDamage.find(d => d.unitId === u.id);
          if (!dmgEntry) return u;
          return { ...u, level: u.level - dmgEntry.damage };
        })
        .filter(u => u.level > 0);
      return { ...sq, units: updatedUnits };
    }),
  };

  return {
    state: { ...newState, actionPoints: state.actionPoints - 1 },
    attackResult: {
      attackerSquares: fromSquares,
      targetSquare: target,
      totalDice,
      threshold,
      hits,
      bonuses,
      unitDamage,
    },
  };
}

/** Check if either player has won (no units on grid or in reserve). */
export function checkWinCondition(state: GameState): Player | null {
  const p1OnGrid = state.grid.some(row =>
    row.some(sq => sq.units.some(u => u.owner === 1))
  );
  const p1InReserve = state.p1Reserve.length > 0;
  const p2OnGrid = state.grid.some(row =>
    row.some(sq => sq.units.some(u => u.owner === 2))
  );
  const p2InReserve = state.p2Reserve.length > 0;

  if (!p2OnGrid && !p2InReserve) return 1;
  if (!p1OnGrid && !p1InReserve) return 2;

  return null;
}

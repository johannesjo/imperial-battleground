// src/actions.ts
import type { GameState, GridRow, Player, Position, Unit } from './types';
import { getSquare, getHomeRow, getReserve } from './game-state';

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

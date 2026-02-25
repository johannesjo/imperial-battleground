// src/game-state.ts
import type { GameState, GridRow, Player, Square, Unit, UnitType, Position, Scenario } from './types';
import { DEFAULT_AP, GRID_COLS, GRID_ROWS } from './types';

let nextId = 0;

export function createUnit(type: UnitType, owner: Player, level: number): Unit {
  return {
    id: `${owner}-${type}-${++nextId}`,
    type,
    owner,
    level,
    hasMoved: false,
    hasAttacked: false,
    movedSquares: 0,
  };
}

function createSquare(col: number, row: number): Square {
  return { position: { col, row }, units: [] };
}

function createGrid(): readonly GridRow[] {
  const rows: GridRow[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row: [Square, Square, Square] = [
      createSquare(0, r),
      createSquare(1, r),
      createSquare(2, r),
    ];
    rows.push(row);
  }
  return rows;
}

function createArmy(owner: Player, config?: Scenario['army']): Unit[] {
  if (config) {
    return config.map(({ type, level }) => createUnit(type, owner, level));
  }
  return [
    createUnit('infantry', owner, 3),
    createUnit('infantry', owner, 2),
    createUnit('infantry', owner, 2),
    createUnit('cavalry', owner, 3),
    createUnit('cavalry', owner, 2),
    createUnit('artillery', owner, 3),
    createUnit('artillery', owner, 2),
  ];
}

export function createInitialState(scenario?: Scenario): GameState {
  return {
    grid: createGrid(),
    p1Reserve: scenario ? createArmy(1, scenario.army) : [],
    p2Reserve: scenario ? createArmy(2, scenario.army) : [],
    currentPlayer: 1,
    actionPoints: DEFAULT_AP,
    maxActionPoints: DEFAULT_AP,
    selectedSquare: null,
    phase: scenario ? 'playing' : 'scenario-select',
    turnNumber: 1,
    winner: null,
    combatLog: [],
  };
}

export function getSquare(state: GameState, pos: Position): Square | undefined {
  const row = state.grid[pos.row];
  if (!row) return undefined;
  return row[pos.col];
}

export function getReserve(state: GameState, player: Player): Unit[] {
  return player === 1 ? state.p1Reserve : state.p2Reserve;
}

export function getHomeRow(player: Player): number {
  return player === 1 ? 0 : 3;
}

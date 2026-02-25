// src/types.ts

export type Player = 1 | 2;

export type UnitType = 'infantry' | 'cavalry' | 'artillery';

export interface Unit {
  readonly id: string;
  readonly type: UnitType;
  readonly owner: Player;
  level: number; // 1-5, represents both HP and attack dice
  hasMoved: boolean; // reset each turn
  hasAttacked: boolean; // reset each turn
  movedSquares: number; // how many squares moved this turn (for cavalry charge)
}

export interface Position {
  readonly col: number; // 0-2
  readonly row: number; // 0-3 for playable grid, -1 for P1 reserve, 4 for P2 reserve
}

export interface Square {
  readonly position: Position;
  readonly units: Unit[];
}

export type GridRow = readonly [Square, Square, Square];

export interface GameState {
  readonly grid: readonly GridRow[]; // 4 rows of 3 columns
  readonly p1Reserve: Unit[];
  readonly p2Reserve: Unit[];
  readonly currentPlayer: Player;
  readonly actionPoints: number;
  readonly maxActionPoints: number;
  readonly selectedSquare: Position | null;
  readonly phase: GamePhase;
  readonly turnNumber: number;
  readonly winner: Player | null;
  readonly combatLog: CombatLogEntry[];
}

export type GamePhase = 'playing' | 'handoff' | 'game-over' | 'retreat-confirm';

export interface CombatLogEntry {
  readonly turn: number;
  readonly player: Player;
  readonly action: string;
  readonly details: string;
}

export interface AttackResult {
  readonly attackerSquares: Position[];
  readonly targetSquare: Position;
  readonly totalDice: number;
  readonly threshold: number;
  readonly hits: number;
  readonly bonuses: BonusType[];
  readonly unitDamage: Array<{ unitId: string; damage: number; destroyed: boolean }>;
}

export type BonusType =
  | 'combined-arms-2'
  | 'combined-arms-3'
  | 'flanking-2'
  | 'flanking-3'
  | 'flanking-4'
  | 'cavalry-charge';

// Constants
export const GRID_COLS = 3;
export const GRID_ROWS = 4;
export const MAX_STACK_SLOTS = 6;
export const MAX_UNITS_PER_SQUARE = 3;
export const DEFAULT_AP = 6;
export const BASE_THRESHOLD = 6;
export const MIN_THRESHOLD = 2;
export const MAX_THRESHOLD = 38;
export const D40 = 40;

export const UNIT_STACK_COST: Record<UnitType, number> = {
  infantry: 1,
  cavalry: 2,
  artillery: 2,
};

export const BONUS_VALUES: Record<BonusType, number> = {
  'combined-arms-2': 4,
  'combined-arms-3': 6,
  'flanking-2': 4,
  'flanking-3': 6,
  'flanking-4': 8,
  'cavalry-charge': 6,
};

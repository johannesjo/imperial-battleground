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

export type GamePhase = 'scenario-select' | 'playing' | 'handoff' | 'game-over' | 'retreat-confirm';

export interface Scenario {
  readonly name: string;
  readonly description: string;
  readonly army: ReadonlyArray<{ type: UnitType; level: number }>;
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: 'Skirmish',
    description: '3 units',
    army: [
      { type: 'infantry', level: 2 },
      { type: 'cavalry', level: 2 },
      { type: 'artillery', level: 2 },
    ],
  },
  {
    name: 'Battle',
    description: '7 units',
    army: [
      { type: 'infantry', level: 3 },
      { type: 'infantry', level: 2 },
      { type: 'infantry', level: 2 },
      { type: 'cavalry', level: 3 },
      { type: 'cavalry', level: 2 },
      { type: 'artillery', level: 3 },
      { type: 'artillery', level: 2 },
    ],
  },
  {
    name: 'War',
    description: '12 units',
    army: [
      { type: 'infantry', level: 3 },
      { type: 'infantry', level: 3 },
      { type: 'infantry', level: 2 },
      { type: 'infantry', level: 2 },
      { type: 'infantry', level: 2 },
      { type: 'cavalry', level: 3 },
      { type: 'cavalry', level: 3 },
      { type: 'cavalry', level: 2 },
      { type: 'cavalry', level: 2 },
      { type: 'artillery', level: 3 },
      { type: 'artillery', level: 2 },
      { type: 'artillery', level: 2 },
    ],
  },
];

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
  | 'cavalry-charge';

// Constants
export const GRID_COLS = 3;
export const GRID_ROWS = 4;
export const MAX_STACK_SLOTS = 6;
export const MAX_UNITS_PER_SQUARE = 3;
export const DEFAULT_AP = 6;
export const BASE_THRESHOLD = 10;
export const MIN_THRESHOLD = 2;
export const MAX_THRESHOLD = 36;
export const D40 = 40;

export const UNIT_STACK_COST: Record<UnitType, number> = {
  infantry: 1,
  cavalry: 2,
  artillery: 2,
};

// Artillery hit thresholds by distance (out of d40)
// 1 field (adjacent): 15%, 2 fields: 50%, 3 fields: 30%
export const ARTILLERY_THRESHOLDS: Record<number, number> = {
  1: 6,   // 6/40 = 15%
  2: 20,  // 20/40 = 50%
  3: 12,  // 12/40 = 30%
};

export const BONUS_VALUES: Record<BonusType, number> = {
  'combined-arms-2': 6,
  'combined-arms-3': 10,
  'flanking-2': 10,
  'flanking-3': 20,
  'cavalry-charge': 6,
};

// Artillery is vulnerable: easier to hit and takes bonus damage when attacked
export const ARTILLERY_VULNERABILITY_THRESHOLD = 4; // +4 to hit threshold (10% easier)
export const ARTILLERY_VULNERABILITY_DAMAGE = 1;    // +1 bonus hit per artillery defender

export interface SquarePreview {
  readonly type: 'move' | 'attack';
  readonly apCost?: number;
  readonly hitChancePct?: number;  // 0-100 weighted average
  readonly hasMelee?: boolean;
  readonly hasArtillery?: boolean;
}

export interface PreviewInfo {
  readonly type: 'attack' | 'move';
  // Attack fields
  readonly selectedUnits?: Unit[];
  readonly totalDice?: number;
  readonly bonuses?: BonusType[];
  readonly threshold?: number;       // melee threshold
  readonly hitChance?: number;        // melee hit chance
  readonly meleeDice?: number;
  readonly artilleryDice?: number;
  readonly artilleryHitChance?: number; // range-based, only when target hovered
  readonly artilleryDistance?: number;
  readonly defenders?: Unit[];
  readonly flankingArtilleryBonus?: number; // extra damage to artillery defenders from flanking
  readonly artilleryVulnerabilityBonus?: number; // extra hits from artillery being vulnerable
  readonly artilleryVulnerabilityThreshold?: number; // threshold boost vs artillery
  // Move fields
  readonly unitCount?: number;
  readonly isGroupMove?: boolean;
}

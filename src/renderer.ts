// src/renderer.ts
import type { GameState, Player, Position, Square, Unit, UnitType } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

const COLORS = {
  bg: '#1a1a2e',
  gridBg: '#16213e',
  gridLine: '#0f3460',
  p1: '#4fc3f7',
  p2: '#ef5350',
  selected: '#ffd54f',
  validMove: 'rgba(76, 175, 80, 0.35)',
  validAttack: 'rgba(255, 152, 0, 0.35)',
  reserve: '#0d1b2a',
  text: '#e0e0e0',
  textDark: '#333',
  button: '#1b5e20',
  buttonText: '#fff',
  retreatBtn: '#b71c1c',
};

const UNIT_SYMBOLS: Record<UnitType, string> = {
  infantry: '\u25A0',
  cavalry: '\u25B2',
  artillery: '\u25CF',
};

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cellSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  reserveHeight: number;
  statusBarHeight: number;
  buttonBarHeight: number;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  const statusBarHeight = 48;
  const buttonBarHeight = 56;
  const reserveHeight = 60;

  const availableHeight = h - statusBarHeight * 2 - buttonBarHeight - reserveHeight * 2;
  const availableWidth = w - 20;

  const cellSize = Math.min(
    Math.floor(availableWidth / GRID_COLS),
    Math.floor(availableHeight / GRID_ROWS)
  );

  const gridWidth = cellSize * GRID_COLS;
  const totalGridHeight = cellSize * GRID_ROWS + reserveHeight * 2;

  const gridOffsetX = Math.floor((w - gridWidth) / 2);
  const gridOffsetY = statusBarHeight + Math.floor((h - statusBarHeight * 2 - buttonBarHeight - totalGridHeight) / 2);

  return { canvas, ctx, cellSize, gridOffsetX, gridOffsetY, reserveHeight, statusBarHeight, buttonBarHeight };
}

export function render(
  rc: RenderContext,
  state: GameState,
  validMoves: Position[],
  validAttacks: Position[],
  flipped: boolean
): void {
  const { ctx, canvas } = rc;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  renderStatusBar(rc, state, 2, 0, flipped);
  renderStatusBar(rc, state, 1, canvas.height - rc.buttonBarHeight - rc.statusBarHeight, flipped);

  const topReserveY = rc.gridOffsetY;
  const bottomReserveY = rc.gridOffsetY + rc.reserveHeight + rc.cellSize * GRID_ROWS;

  renderReserve(rc, state, flipped ? 1 : 2, topReserveY);
  renderReserve(rc, state, flipped ? 2 : 1, bottomReserveY);

  const gridTop = rc.gridOffsetY + rc.reserveHeight;
  renderGrid(rc, state, gridTop, validMoves, validAttacks, flipped);

  renderButtons(rc, state);
}

function renderStatusBar(rc: RenderContext, state: GameState, player: Player, y: number, _flipped: boolean): void {
  const { ctx, canvas } = rc;
  ctx.fillStyle = player === state.currentPlayer ? (player === 1 ? COLORS.p1 : COLORS.p2) : '#333';
  ctx.globalAlpha = player === state.currentPlayer ? 0.15 : 0.05;
  ctx.fillRect(0, y, canvas.width, rc.statusBarHeight);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const apDisplay = player === state.currentPlayer
    ? '\u25CF'.repeat(state.actionPoints) + '\u25CB'.repeat(state.maxActionPoints - state.actionPoints)
    : '';

  ctx.fillText(`P${player}  ${apDisplay}`, 12, y + rc.statusBarHeight / 2);

  ctx.textAlign = 'right';
  ctx.fillText(`Turn ${state.turnNumber}`, canvas.width - 12, y + rc.statusBarHeight / 2);
}

function renderReserve(rc: RenderContext, state: GameState, player: Player, y: number): void {
  const { ctx, cellSize, gridOffsetX } = rc;
  const gridWidth = cellSize * GRID_COLS;

  ctx.fillStyle = COLORS.reserve;
  ctx.fillRect(gridOffsetX, y, gridWidth, rc.reserveHeight);
  ctx.strokeStyle = COLORS.gridLine;
  ctx.strokeRect(gridOffsetX, y, gridWidth, rc.reserveHeight);

  const reserve = player === 1 ? state.p1Reserve : state.p2Reserve;
  const color = player === 1 ? COLORS.p1 : COLORS.p2;

  ctx.fillStyle = color;
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const flagText = `\u2691 P${player} RESERVES`;
  ctx.fillText(flagText, gridOffsetX + gridWidth / 2, y + 14);

  const unitSize = 20;
  const padding = 4;
  const startX = gridOffsetX + 10;
  const unitY = y + 36;

  reserve.forEach((unit, i) => {
    const ux = startX + i * (unitSize + padding);
    ctx.fillStyle = color;
    ctx.font = `${unitSize - 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(UNIT_SYMBOLS[unit.type], ux + unitSize / 2, unitY);
    ctx.font = '9px monospace';
    ctx.fillText(`${unit.level}`, ux + unitSize / 2, unitY + 12);
  });
}

function renderGrid(
  rc: RenderContext,
  state: GameState,
  gridTop: number,
  validMoves: Position[],
  validAttacks: Position[],
  flipped: boolean
): void {
  const { ctx, cellSize, gridOffsetX } = rc;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const displayRow = flipped ? GRID_ROWS - 1 - r : r;
      const displayCol = flipped ? GRID_COLS - 1 - c : c;

      const x = gridOffsetX + displayCol * cellSize;
      const y = gridTop + (GRID_ROWS - 1 - displayRow) * cellSize;

      ctx.fillStyle = COLORS.gridBg;
      ctx.fillRect(x, y, cellSize, cellSize);

      if (validMoves.some(p => p.col === c && p.row === r)) {
        ctx.fillStyle = COLORS.validMove;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
      if (validAttacks.some(p => p.col === c && p.row === r)) {
        ctx.fillStyle = COLORS.validAttack;
        ctx.fillRect(x, y, cellSize, cellSize);
      }

      if (state.selectedSquare && state.selectedSquare.col === c && state.selectedSquare.row === r) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        ctx.lineWidth = 1;
      }

      ctx.strokeStyle = COLORS.gridLine;
      ctx.strokeRect(x, y, cellSize, cellSize);

      const sq = state.grid[r]?.[c];
      if (sq && sq.units.length > 0) {
        renderUnitsInSquare(ctx, sq.units, x, y, cellSize);
      }
    }
  }
}

function renderUnitsInSquare(
  ctx: CanvasRenderingContext2D,
  units: Unit[],
  x: number,
  y: number,
  cellSize: number
): void {
  const maxPerRow = 3;
  const unitSize = Math.min(cellSize / maxPerRow - 2, 28);

  units.forEach((unit, i) => {
    const col = i % maxPerRow;
    const row = Math.floor(i / maxPerRow);
    const ux = x + 6 + col * (unitSize + 2);
    const uy = y + 6 + row * (unitSize + 8);

    ctx.fillStyle = unit.owner === 1 ? COLORS.p1 : COLORS.p2;
    ctx.font = `${unitSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(UNIT_SYMBOLS[unit.type], ux + unitSize / 2, uy + unitSize / 2);

    ctx.font = '10px monospace';
    ctx.fillText(`${unit.level}`, ux + unitSize / 2, uy + unitSize / 2 + unitSize / 2 + 4);
  });
}

function renderButtons(rc: RenderContext, _state: GameState): void {
  const { ctx, canvas, buttonBarHeight } = rc;
  const y = canvas.height - buttonBarHeight;
  const btnWidth = canvas.width / 2 - 16;
  const btnHeight = 40;
  const btnY = y + (buttonBarHeight - btnHeight) / 2;

  ctx.fillStyle = COLORS.button;
  ctx.fillRect(8, btnY, btnWidth, btnHeight);
  ctx.fillStyle = COLORS.buttonText;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('END TURN', 8 + btnWidth / 2, btnY + btnHeight / 2);

  ctx.fillStyle = COLORS.retreatBtn;
  ctx.fillRect(canvas.width / 2 + 8, btnY, btnWidth, btnHeight);
  ctx.fillStyle = COLORS.buttonText;
  ctx.fillText('RETREAT', canvas.width / 2 + 8 + btnWidth / 2, btnY + btnHeight / 2);
}

export function renderHandoff(rc: RenderContext, player: Player): void {
  const { ctx, canvas } = rc;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = COLORS.text;
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Pass to Player ${player}`, canvas.width / 2, canvas.height / 2 - 30);

  ctx.font = '18px monospace';
  ctx.fillText('Tap to continue', canvas.width / 2, canvas.height / 2 + 20);
}

export function renderGameOver(rc: RenderContext, winner: Player): void {
  const { ctx, canvas } = rc;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = winner === 1 ? COLORS.p1 : COLORS.p2;
  ctx.font = '32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Player ${winner} Wins!`, canvas.width / 2, canvas.height / 2 - 20);

  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText('Tap to play again', canvas.width / 2, canvas.height / 2 + 20);
}

export function screenToGrid(
  rc: RenderContext,
  screenX: number,
  screenY: number,
  flipped: boolean
): { type: 'grid'; pos: Position } | { type: 'reserve'; player: Player } | { type: 'endTurn' } | { type: 'retreat' } | null {
  const { gridOffsetX, gridOffsetY, cellSize, reserveHeight, canvas, buttonBarHeight } = rc;
  const gridTop = gridOffsetY + reserveHeight;
  const gridWidth = cellSize * GRID_COLS;

  const btnY = canvas.height - buttonBarHeight;
  if (screenY >= btnY) {
    if (screenX < canvas.width / 2) return { type: 'endTurn' };
    return { type: 'retreat' };
  }

  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= gridOffsetY &&
    screenY < gridOffsetY + reserveHeight
  ) {
    return { type: 'reserve', player: flipped ? 1 : 2 };
  }

  const bottomReserveY = gridOffsetY + reserveHeight + cellSize * GRID_ROWS;
  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= bottomReserveY &&
    screenY < bottomReserveY + reserveHeight
  ) {
    return { type: 'reserve', player: flipped ? 2 : 1 };
  }

  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= gridTop &&
    screenY < gridTop + cellSize * GRID_ROWS
  ) {
    let displayCol = Math.floor((screenX - gridOffsetX) / cellSize);
    let displayRow = GRID_ROWS - 1 - Math.floor((screenY - gridTop) / cellSize);

    const col = flipped ? GRID_COLS - 1 - displayCol : displayCol;
    const row = flipped ? GRID_ROWS - 1 - displayRow : displayRow;

    return { type: 'grid', pos: { col, row } };
  }

  return null;
}

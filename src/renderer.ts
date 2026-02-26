// src/renderer.ts
import type { AttackResult, GameState, Player, Position, Scenario, SquarePreview, Unit, UnitType } from './types';
import { GRID_COLS, GRID_ROWS, BONUS_VALUES } from './types';

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

// Canvas-drawn unit icon functions
function drawInfantry(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size * 0.4;

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.7, s * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.42);
  ctx.lineTo(cx, cy + s * 0.3);
  ctx.stroke();

  // Arms — one forward holding rifle
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.4, cy - s * 0.15);
  ctx.lineTo(cx, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.35, cy - s * 0.35);
  ctx.stroke();

  // Rifle
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.2, cy - s * 0.65);
  ctx.lineTo(cx + s * 0.4, cy - s * 0.15);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.3);
  ctx.lineTo(cx - s * 0.3, cy + s * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.3);
  ctx.lineTo(cx + s * 0.3, cy + s * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawCavalry(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size * 0.42;

  // Horse body (ellipse)
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.15, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();

  // Horse neck and head
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.4, cy);
  ctx.quadraticCurveTo(cx + s * 0.55, cy - s * 0.5, cx + s * 0.35, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.65, cy - s * 0.65);
  ctx.quadraticCurveTo(cx + s * 0.7, cy - s * 0.45, cx + s * 0.45, cy - s * 0.1);
  ctx.fill();

  // Horse ear
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.4, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.35, cy - s * 0.9);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.72);
  ctx.fill();

  // Legs
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.35, cy + s * 0.35);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.15, cy + s * 0.35);
  ctx.lineTo(cx - s * 0.1, cy + s * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.15, cy + s * 0.35);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.35, cy + s * 0.35);
  ctx.lineTo(cx + s * 0.4, cy + s * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawArtillery(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.08);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size * 0.4;

  // Barrel
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.7, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.2);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.0);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.0);
  ctx.closePath();
  ctx.fill();

  // Barrel muzzle flare
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.5, cy - s * 0.28);
  ctx.lineTo(cx + s * 0.7, cy - s * 0.28);
  ctx.lineTo(cx + s * 0.7, cy + s * 0.08);
  ctx.lineTo(cx + s * 0.5, cy + s * 0.08);
  ctx.closePath();
  ctx.fill();

  // Wheel
  ctx.beginPath();
  ctx.arc(cx - s * 0.15, cy + s * 0.35, s * 0.35, 0, Math.PI * 2);
  ctx.stroke();
  // Wheel spokes
  for (let a = 0; a < 4; a++) {
    const angle = (a * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.15 + Math.cos(angle) * s * 0.1, cy + s * 0.35 + Math.sin(angle) * s * 0.1);
    ctx.lineTo(cx - s * 0.15 + Math.cos(angle) * s * 0.32, cy + s * 0.35 + Math.sin(angle) * s * 0.32);
    ctx.stroke();
  }

  // Trail/support
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy + s * 0.05);
  ctx.lineTo(cx - s * 0.9, cy + s * 0.55);
  ctx.stroke();

  ctx.restore();
}

function drawUnitIcon(ctx: CanvasRenderingContext2D, type: UnitType, cx: number, cy: number, size: number, color: string): void {
  switch (type) {
    case 'infantry': drawInfantry(ctx, cx, cy, size, color); break;
    case 'cavalry': drawCavalry(ctx, cx, cy, size, color); break;
    case 'artillery': drawArtillery(ctx, cx, cy, size, color); break;
  }
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;   // CSS pixel width
  height: number;  // CSS pixel height
  cellSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  reserveHeight: number;
  statusBarHeight: number;
  buttonBarHeight: number;
}

export function createRenderContext(canvas: HTMLCanvasElement): RenderContext {
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Work in CSS pixel space
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  const statusBarHeight = 48;
  const buttonBarHeight = 56;
  const reserveHeight = 80;

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

  return { canvas, ctx, width: w, height: h, cellSize, gridOffsetX, gridOffsetY, reserveHeight, statusBarHeight, buttonBarHeight };
}

export function render(
  rc: RenderContext,
  state: GameState,
  validMoves: Position[],
  validAttacks: Position[],
  flipped: boolean,
  selectedUnitIds: string[] = [],
  selectedSquares: Position[] = [],
  attackResult: AttackResult | null = null,
  attackAnimProgress = 0,
  squarePreviews: Map<string, SquarePreview> = new Map()
): void {
  const { ctx, width, height } = rc;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  renderStatusBar(rc, state, 2, 0, flipped);
  renderStatusBar(rc, state, 1, height - rc.buttonBarHeight - rc.statusBarHeight, flipped);

  const topReserveY = rc.gridOffsetY;
  const bottomReserveY = rc.gridOffsetY + rc.reserveHeight + rc.cellSize * GRID_ROWS;

  renderReserve(rc, state, flipped ? 1 : 2, topReserveY, selectedUnitIds);
  renderReserve(rc, state, flipped ? 2 : 1, bottomReserveY, selectedUnitIds);

  const gridTop = rc.gridOffsetY + rc.reserveHeight;
  renderGrid(rc, state, gridTop, validMoves, validAttacks, flipped, selectedUnitIds, selectedSquares, squarePreviews);

  if (attackResult && attackAnimProgress < 1) {
    renderAttackResult(rc, attackResult, attackAnimProgress, gridTop, flipped);
  }

  renderButtons(rc, state);
}

function renderStatusBar(rc: RenderContext, state: GameState, player: Player, y: number, _flipped: boolean): void {
  const { ctx, width } = rc;
  ctx.fillStyle = player === state.currentPlayer ? (player === 1 ? COLORS.p1 : COLORS.p2) : '#333';
  ctx.globalAlpha = player === state.currentPlayer ? 0.15 : 0.05;
  ctx.fillRect(0, y, width, rc.statusBarHeight);
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.text;
  ctx.font = '16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.fillText(`P${player}`, 12, y + rc.statusBarHeight / 2);

  if (player === state.currentPlayer) {
    ctx.fillStyle = '#90a4ae';
    ctx.font = '11px monospace';
    ctx.fillText('ACTION POINTS', 50, y + rc.statusBarHeight / 2 - 14);
    ctx.fillStyle = COLORS.text;
    const apDisplay = Array(state.actionPoints).fill('\u25CF').concat(Array(state.maxActionPoints - state.actionPoints).fill('\u25CB')).join(' ');
    ctx.font = '32px monospace';
    ctx.fillText(apDisplay, 50, y + rc.statusBarHeight / 2 + 10);
  }

  ctx.textAlign = 'right';
  ctx.fillText(`Turn ${state.turnNumber}`, width - 12, y + rc.statusBarHeight / 2);
}

function renderReserve(rc: RenderContext, state: GameState, player: Player, y: number, selectedUnitIds: string[] = []): void {
  const { ctx, cellSize, gridOffsetX } = rc;
  const gridWidth = cellSize * GRID_COLS;

  ctx.fillStyle = COLORS.reserve;
  ctx.fillRect(gridOffsetX, y, gridWidth, rc.reserveHeight);
  ctx.strokeStyle = COLORS.gridLine;
  ctx.strokeRect(gridOffsetX, y, gridWidth, rc.reserveHeight);

  const reserve = player === 1 ? state.p1Reserve : state.p2Reserve;
  const color = player === 1 ? COLORS.p1 : COLORS.p2;

  if (reserve.length === 0) return;

  const { iconSize, padding, startX } = getReserveLayout(gridOffsetX, gridWidth, reserve.length, rc.reserveHeight);
  const iconCenterY = y + rc.reserveHeight / 2 - 4;

  reserve.forEach((unit, i) => {
    const cx = startX + i * (iconSize + padding) + iconSize / 2;
    const isSelected = selectedUnitIds.includes(unit.id);
    const unitColor = isSelected ? COLORS.selected : color;

    if (isSelected) {
      ctx.save();
      ctx.shadowColor = COLORS.selected;
      ctx.shadowBlur = 14;
      ctx.fillStyle = COLORS.selected;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(cx, iconCenterY, iconSize / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawUnitIcon(ctx, unit.type, cx, iconCenterY, iconSize, unitColor);
    drawHpIcons(ctx, unit.type, cx, iconCenterY + iconSize * 0.45, unit.level, unitColor, Math.max(6, iconSize * 0.25));
  });
}

const COMPACT_BONUS: Record<string, string> = {
  'combined-arms-2': 'CA',
  'combined-arms-3': 'CA+',
  'flanking-2': 'FL',
  'flanking-3': 'FL+',
  'cavalry-charge': 'CH',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function drawBottomLabel(ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, cellSize: number): void {
  const fontSize = clamp(cellSize * 0.14, 12, 16);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const textWidth = ctx.measureText(text).width;
  const pad = 3;
  const stripH = fontSize + pad * 2;
  // Semi-transparent background strip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x + (cellSize - textWidth) / 2 - pad, y + cellSize - stripH, textWidth + pad * 2, stripH);
  ctx.fillStyle = color;
  ctx.fillText(text, x + cellSize / 2, y + cellSize - pad);
}

function drawTopLabel(ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, cellSize: number): void {
  const fontSize = clamp(cellSize * 0.11, 10, 13);
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textWidth = ctx.measureText(text).width;
  const pad = 2;
  const stripH = fontSize + pad * 2;
  // Semi-transparent background strip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x + (cellSize - textWidth) / 2 - pad, y, textWidth + pad * 2, stripH);
  ctx.fillStyle = color;
  ctx.fillText(text, x + cellSize / 2, y + pad);
}

function renderInlinePreview(ctx: CanvasRenderingContext2D, preview: SquarePreview, x: number, y: number, cellSize: number): void {
  if (preview.type === 'move') {
    drawBottomLabel(ctx, '1 AP', '#fff', x, y, cellSize);
  } else if (preview.type === 'attack') {
    // Bottom: dice count + color-coded hit%
    const totalDice = preview.totalDice ?? 0;
    const meleeDice = preview.meleeDice ?? 0;
    const artDice = preview.artilleryDice ?? 0;
    let diceStr: string;
    if (meleeDice > 0 && artDice > 0) {
      diceStr = `${meleeDice}m ${artDice}a`;
    } else {
      diceStr = `${totalDice}d`;
    }
    const pct = preview.hitChancePct ?? 0;
    const pctColor = pct >= 40 ? '#4caf50' : pct >= 20 ? '#ffeb3b' : '#f44336';
    // Draw dice in white, then hit% in color
    const text = `${diceStr} ${pct}%`;
    // Use single drawBottomLabel with pctColor for the combined text
    drawBottomLabel(ctx, text, pctColor, x, y, cellSize);
  } else if (preview.type === 'selected') {
    // Bottom: dice summary (white)
    const meleeDice = preview.meleeDice ?? 0;
    const artDice = preview.artilleryDice ?? 0;
    const totalDice = preview.totalDice ?? 0;
    if (totalDice > 0) {
      let diceStr: string;
      if (meleeDice > 0 && artDice > 0) {
        diceStr = `${meleeDice}m ${artDice}a`;
      } else {
        diceStr = `${totalDice}d`;
      }
      drawBottomLabel(ctx, diceStr, '#fff', x, y, cellSize);
    }
    // Top: compact bonus labels (gold)
    const bonuses = preview.bonuses ?? [];
    if (bonuses.length > 0) {
      const bonusStr = bonuses.map(b => `\u2605${COMPACT_BONUS[b] ?? b}`).join(' ');
      drawTopLabel(ctx, bonusStr, '#ffd54f', x, y, cellSize);
    }
  }
}

function renderGrid(
  rc: RenderContext,
  state: GameState,
  gridTop: number,
  validMoves: Position[],
  validAttacks: Position[],
  flipped: boolean,
  selectedUnitIds: string[] = [],
  selectedSquares: Position[] = [],
  squarePreviews: Map<string, SquarePreview> = new Map()
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

      if (selectedSquares.some(s => s.col === c && s.row === r)) {
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        ctx.lineWidth = 1;
      }

      ctx.strokeStyle = COLORS.gridLine;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Column separator lines (3 fixed columns)
      ctx.save();
      ctx.strokeStyle = COLORS.gridLine;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.5;
      const third = cellSize / 3;
      ctx.beginPath();
      ctx.moveTo(x + third, y);
      ctx.lineTo(x + third, y + cellSize);
      ctx.moveTo(x + third * 2, y);
      ctx.lineTo(x + third * 2, y + cellSize);
      ctx.stroke();
      ctx.restore();

      const sq = state.grid[r]?.[c];
      if (sq && sq.units.length > 0) {
        renderUnitsInSquare(ctx, sq.units, x, y, cellSize, selectedUnitIds);
      }

      // Inline square preview
      const preview = squarePreviews.get(`${c},${r}`);
      if (preview) {
        renderInlinePreview(ctx, preview, x, y, cellSize);
      }
    }
  }
}

function drawHpIcons(ctx: CanvasRenderingContext2D, type: UnitType, cx: number, y: number, hp: number, color: string, iconSize: number): void {
  const count = Math.min(hp, 3);
  const spacing = iconSize * 0.9;
  const totalWidth = (count - 1) * spacing;
  const startX = cx - totalWidth / 2;
  for (let i = 0; i < count; i++) {
    drawUnitIcon(ctx, type, startX + i * spacing, y, iconSize, color);
  }
}

function renderUnitsInSquare(
  ctx: CanvasRenderingContext2D,
  units: Unit[],
  x: number,
  y: number,
  cellSize: number,
  selectedUnitIds: string[] = []
): void {
  const colWidth = cellSize / 3;
  const maxLevel = 3;
  const gap = 2;
  const iconSize = Math.min(colWidth - 6, (cellSize - (maxLevel - 1) * gap) / maxLevel);

  units.forEach((unit, i) => {
    if (i >= 3) return;
    const cx = x + colWidth * i + colWidth / 2;
    const isSelected = selectedUnitIds.includes(unit.id);
    const baseColor = unit.owner === 1 ? COLORS.p1 : COLORS.p2;
    const color = isSelected ? COLORS.selected : baseColor;

    // Stack height for this unit
    const stackH = unit.level * iconSize + (unit.level - 1) * gap;
    const startY = y + (cellSize - stackH) / 2;

    if (isSelected) {
      ctx.save();
      ctx.shadowColor = COLORS.selected;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.selected;
      ctx.globalAlpha = 0.2;
      roundRect(ctx, cx - iconSize / 2 - 3, startY - 3, iconSize + 6, stackH + 6, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw level-count stacked icons (top to bottom)
    for (let lvl = 0; lvl < unit.level; lvl++) {
      const iconY = startY + lvl * (iconSize + gap) + iconSize / 2;
      drawUnitIcon(ctx, unit.type, cx, iconY, iconSize, color);
    }
  });
}

function gridCellScreen(
  rc: RenderContext,
  pos: Position,
  gridTop: number,
  flipped: boolean
): { x: number; y: number } {
  const displayCol = flipped ? GRID_COLS - 1 - pos.col : pos.col;
  const displayRow = flipped ? GRID_ROWS - 1 - pos.row : pos.row;
  const x = rc.gridOffsetX + displayCol * rc.cellSize;
  const y = gridTop + (GRID_ROWS - 1 - displayRow) * rc.cellSize;
  return { x, y };
}

const BONUS_LABELS: Record<string, string> = {
  'combined-arms-2': 'Combined Arms',
  'combined-arms-3': 'Combined Arms+',
  'flanking-2': 'Flanking',
  'flanking-3': 'Flanking+',
  'cavalry-charge': 'Cavalry Charge',
};

function renderAttackResult(
  rc: RenderContext,
  result: AttackResult,
  progress: number,
  gridTop: number,
  flipped: boolean
): void {
  const { ctx, cellSize, width } = rc;

  // Phase 1 (0-0.3): flash target square
  // Phase 2 (0.1-0.9): show result panel
  // Phase 3 (0.7-1.0): fade out

  // Flash target square red
  if (progress < 0.4) {
    const flashAlpha = progress < 0.15
      ? progress / 0.15
      : Math.max(0, 1 - (progress - 0.15) / 0.25);
    const { x, y } = gridCellScreen(rc, result.targetSquare, gridTop, flipped);
    ctx.save();
    ctx.fillStyle = result.hits > 0 ? '#ff1744' : '#666';
    ctx.globalAlpha = flashAlpha * 0.6;
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.restore();
  }

  // Flash attacker squares
  if (progress < 0.3) {
    const flashAlpha = Math.max(0, 1 - progress / 0.3);
    for (const sq of result.attackerSquares) {
      const { x, y } = gridCellScreen(rc, sq, gridTop, flipped);
      ctx.save();
      ctx.fillStyle = '#ffd54f';
      ctx.globalAlpha = flashAlpha * 0.4;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.restore();
    }
  }

  // Result panel
  const panelAlpha = progress < 0.1
    ? progress / 0.1
    : progress > 0.7
      ? Math.max(0, 1 - (progress - 0.7) / 0.3)
      : 1;

  if (panelAlpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = panelAlpha;

  // Panel dimensions
  const panelW = Math.min(280, width - 32);
  const lineH = 22;
  const bonusLines = result.bonuses.length;
  const damageLines = result.unitDamage.length;
  const panelH = 70 + bonusLines * lineH + (damageLines > 0 ? 26 + damageLines * lineH : 0);
  const panelX = (width - panelW) / 2;

  // Position panel near target square
  const target = gridCellScreen(rc, result.targetSquare, gridTop, flipped);
  const targetCenterY = target.y + cellSize / 2;
  let panelY = targetCenterY - panelH - 12;
  if (panelY < 8) panelY = targetCenterY + cellSize + 12;

  // Panel background
  ctx.fillStyle = '#0d1b2a';
  ctx.strokeStyle = result.hits > 0 ? '#ff5722' : '#546e7a';
  ctx.lineWidth = 2;
  roundRect(ctx, panelX, panelY, panelW, panelH, 8);
  ctx.fill();
  ctx.stroke();

  let textY = panelY + 20;

  // Title line
  ctx.fillStyle = result.hits > 0 ? '#ff8a65' : '#90a4ae';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    result.hits > 0 ? `\u2694 ATTACK \u2014 ${result.hits} HIT${result.hits !== 1 ? 'S' : ''}!` : '\u2694 ATTACK \u2014 MISS!',
    panelX + panelW / 2,
    textY
  );
  textY += 26;

  // Dice & threshold
  ctx.fillStyle = '#b0bec5';
  ctx.font = '13px monospace';
  ctx.fillText(
    `${result.totalDice} dice \u00d7 d40  |  threshold \u2264 ${result.threshold}`,
    panelX + panelW / 2,
    textY
  );
  textY += 24;

  // Bonuses
  if (bonusLines > 0) {
    for (const bonus of result.bonuses) {
      ctx.fillStyle = '#ffcc02';
      ctx.font = '12px monospace';
      ctx.fillText(
        `\u2605 ${BONUS_LABELS[bonus] ?? bonus} (+${BONUS_VALUES[bonus]})`,
        panelX + panelW / 2,
        textY
      );
      textY += lineH;
    }
  }

  // Damage breakdown
  if (damageLines > 0) {
    textY += 4;
    for (const dmg of result.unitDamage) {
      ctx.fillStyle = dmg.destroyed ? '#ff1744' : '#ef9a9a';
      ctx.font = '12px monospace';
      const status = dmg.destroyed ? 'DESTROYED' : `${dmg.damage} dmg`;
      ctx.fillText(
        `${status}`,
        panelX + panelW / 2,
        textY
      );
      textY += lineH;
    }
  }

  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderButtons(rc: RenderContext, _state: GameState): void {
  const { ctx, width, height, buttonBarHeight } = rc;
  const y = height - buttonBarHeight;
  const btnHeight = 40;
  const btnY = y + (buttonBarHeight - btnHeight) / 2;

  // END TURN — main button
  const endTurnWidth = width - 100;
  ctx.fillStyle = COLORS.button;
  roundRect(ctx, 8, btnY, endTurnWidth, btnHeight, 6);
  ctx.fill();
  ctx.fillStyle = COLORS.buttonText;
  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('END TURN', 8 + endTurnWidth / 2, btnY + btnHeight / 2);

  // RETREAT — small text on the right
  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('retreat', width - 42, btnY + btnHeight / 2);
}

export function renderHandoff(rc: RenderContext, player: Player): void {
  const { ctx, width, height } = rc;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.text;
  ctx.font = '28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Pass to Player ${player}`, width / 2, height / 2 - 30);

  ctx.font = '18px monospace';
  ctx.fillText('Tap to continue', width / 2, height / 2 + 20);
}

export function renderGameOver(rc: RenderContext, winner: Player): void {
  const { ctx, width, height } = rc;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = winner === 1 ? COLORS.p1 : COLORS.p2;
  ctx.font = '32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Player ${winner} Wins!`, width / 2, height / 2 - 20);

  ctx.fillStyle = COLORS.text;
  ctx.font = '18px monospace';
  ctx.fillText('Tap to play again', width / 2, height / 2 + 20);
}

function getReserveLayout(gridOffsetX: number, gridWidth: number, count: number, reserveHeight: number): { iconSize: number; padding: number; startX: number; gap: number; topPad: number } {
  const topPad = 6;
  const botPad = 6;
  const gap = 4;
  const maxLevel = 3;
  const availH = reserveHeight - topPad - botPad;
  const iconSize = Math.min(40, Math.floor((availH - (maxLevel - 1) * gap) / maxLevel));
  const padding = Math.max(6, iconSize * 0.35);
  const totalWidth = count * iconSize + (count - 1) * padding;
  const startX = gridOffsetX + (gridWidth - totalWidth) / 2;
  return { iconSize, padding, startX, gap, topPad };
}

function getReserveUnitIndex(screenX: number, gridOffsetX: number, gridWidth: number, count: number, reserveHeight: number): number {
  if (count <= 0) return 0;
  const { iconSize, padding, startX } = getReserveLayout(gridOffsetX, gridWidth, count, reserveHeight);
  const relX = screenX - startX;
  const idx = Math.floor(relX / (iconSize + padding));
  return Math.max(0, Math.min(count - 1, idx));
}

export function screenToGrid(
  rc: RenderContext,
  screenX: number,
  screenY: number,
  flipped: boolean,
  reserveCounts?: { p1: number; p2: number }
): { type: 'grid'; pos: Position; unitIndex: number } | { type: 'reserve'; player: Player; unitIndex: number } | { type: 'endTurn' } | { type: 'retreat' } | null {
  const { gridOffsetX, gridOffsetY, cellSize, reserveHeight, width, height, buttonBarHeight } = rc;
  const gridTop = gridOffsetY + reserveHeight;
  const gridWidth = cellSize * GRID_COLS;

  const btnY = height - buttonBarHeight;
  if (screenY >= btnY) {
    if (screenX >= width - 84) return { type: 'retreat' };
    return { type: 'endTurn' };
  }

  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= gridOffsetY &&
    screenY < gridOffsetY + reserveHeight
  ) {
    const player: Player = flipped ? 1 : 2;
    const unitIndex = getReserveUnitIndex(screenX, gridOffsetX, gridWidth, reserveCounts ? (player === 1 ? reserveCounts.p1 : reserveCounts.p2) : 0, reserveHeight);
    return { type: 'reserve', player, unitIndex };
  }

  const bottomReserveY = gridOffsetY + reserveHeight + cellSize * GRID_ROWS;
  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= bottomReserveY &&
    screenY < bottomReserveY + reserveHeight
  ) {
    const player: Player = flipped ? 2 : 1;
    const unitIndex = getReserveUnitIndex(screenX, gridOffsetX, gridWidth, reserveCounts ? (player === 1 ? reserveCounts.p1 : reserveCounts.p2) : 0, reserveHeight);
    return { type: 'reserve', player, unitIndex };
  }

  if (
    screenX >= gridOffsetX &&
    screenX < gridOffsetX + gridWidth &&
    screenY >= gridTop &&
    screenY < gridTop + cellSize * GRID_ROWS
  ) {
    const displayCol = Math.floor((screenX - gridOffsetX) / cellSize);
    const displayRow = GRID_ROWS - 1 - Math.floor((screenY - gridTop) / cellSize);

    const col = flipped ? GRID_COLS - 1 - displayCol : displayCol;
    const row = flipped ? GRID_ROWS - 1 - displayRow : displayRow;

    // Detect which sub-column (unit slot 0-2) was clicked within the cell
    const cellX = screenX - gridOffsetX - displayCol * cellSize;
    const unitIndex = Math.min(2, Math.floor(cellX / (cellSize / 3)));

    return { type: 'grid', pos: { col, row }, unitIndex };
  }

  return null;
}

export function renderScenarioSelect(rc: RenderContext, scenarios: readonly Scenario[]): void {
  const { ctx, width, height } = rc;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IMPERIAL BATTLEGROUND', width / 2, height * 0.12);

  ctx.font = '14px monospace';
  ctx.fillStyle = '#90a4ae';
  ctx.fillText('Choose your battle', width / 2, height * 0.12 + 34);

  // Cards
  const cardW = Math.min(320, width - 40);
  const cardH = 72;
  const gap = 16;
  const totalH = scenarios.length * cardH + (scenarios.length - 1) * gap;
  const startY = (height - totalH) / 2 + 20;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const cardX = (width - cardW) / 2;
    const cardY = startY + i * (cardH + gap);

    // Card background
    ctx.fillStyle = '#16213e';
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 2;
    roundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();
    ctx.stroke();

    // Scenario name
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(scenario.name, width / 2, cardY + cardH / 2 - 12);

    // Unit count
    ctx.fillStyle = '#90a4ae';
    ctx.font = '13px monospace';
    ctx.fillText(scenario.description, width / 2, cardY + cardH / 2 + 14);
  }
}

export function screenToScenario(rc: RenderContext, x: number, y: number, scenarioCount: number): number | null {
  const { width, height } = rc;
  const cardW = Math.min(320, width - 40);
  const cardH = 72;
  const gap = 16;
  const totalH = scenarioCount * cardH + (scenarioCount - 1) * gap;
  const startY = (height - totalH) / 2 + 20;
  const cardX = (width - cardW) / 2;

  for (let i = 0; i < scenarioCount; i++) {
    const cardY = startY + i * (cardH + gap);
    if (x >= cardX && x <= cardX + cardW && y >= cardY && y <= cardY + cardH) {
      return i;
    }
  }
  return null;
}

// src/renderer.ts
import type { AttackResult, GameState, Player, Position, Scenario, SquarePreview, Unit, UnitType } from './types';
import { GRID_COLS, GRID_ROWS, BONUS_VALUES } from './types';
import {
  COLORS, themeFont, monoFont, playerColor, playerColorLight, playerColorDark,
  drawTextWithShadow, drawGradientRect, drawOrnateFrame, draw9SliceFrame, roundRect,
  drawRadialGradientBg, drawLaurelWreath, drawShieldEmblem, drawDecorativeLine,
} from './theme';

// Animation state (set from main.ts)
export let animTime = 0;
export function setAnimTime(t: number): void { animTime = t; }

// --- Detailed procedural unit icons ---

function darken(hex: string, amount: number): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

function safeColor(color: string): { hex: string; isHex: boolean } {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    return { hex: color, isHex: true };
  }
  return { hex: '#888888', isHex: false };
}

function drawInfantry(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  const { hex } = safeColor(color);
  const dark = darken(hex, 40);
  const light = lighten(hex, 40);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size * 0.38;

  // Helmet with plume
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.65, s * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // Helmet highlight
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(cx - s * 0.08, cy - s * 0.72, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Plume
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 0.97);
  ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 1.1, cx + s * 0.3, cy - s * 0.85);
  ctx.quadraticCurveTo(cx + s * 0.15, cy - s * 0.8, cx, cy - s * 0.9);
  ctx.fill();

  // Body/torso
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.25, cy - s * 0.33);
  ctx.lineTo(cx + s * 0.25, cy - s * 0.33);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.2);
  ctx.closePath();
  ctx.fill();

  // Shield (left side)
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.42, cy - s * 0.05, s * 0.2, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  // Shield cross
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(1, size * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, cy - s * 0.25);
  ctx.lineTo(cx - s * 0.42, cy + s * 0.15);
  ctx.moveTo(cx - s * 0.55, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.29, cy - s * 0.05);
  ctx.stroke();

  // Spear (right side, diagonal)
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(1.5, size * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.15, cy + s * 0.5);
  ctx.lineTo(cx + s * 0.45, cy - s * 0.9);
  ctx.stroke();
  // Spear tip
  ctx.fillStyle = '#c0c0c0';
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.45, cy - s * 0.9);
  ctx.lineTo(cx + s * 0.38, cy - s * 0.75);
  ctx.lineTo(cx + s * 0.52, cy - s * 0.75);
  ctx.closePath();
  ctx.fill();

  // Legs
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.5, size * 0.06);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.12, cy + s * 0.2);
  ctx.lineTo(cx - s * 0.2, cy + s * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.12, cy + s * 0.2);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.7);
  ctx.stroke();

  ctx.restore();
}

function drawCavalry(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  const { hex } = safeColor(color);
  const dark = darken(hex, 50);
  const light = lighten(hex, 40);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size * 0.40;

  // Horse body
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.05, cy + s * 0.15, s * 0.55, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // Horse neck and head
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.35, cy + s * 0.0);
  ctx.quadraticCurveTo(cx + s * 0.55, cy - s * 0.4, cx + s * 0.4, cy - s * 0.6);
  ctx.lineTo(cx + s * 0.65, cy - s * 0.55);
  ctx.quadraticCurveTo(cx + s * 0.7, cy - s * 0.35, cx + s * 0.45, cy - s * 0.05);
  ctx.fill();

  // Horse eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx + s * 0.52, cy - s * 0.48, s * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Horse ear
  ctx.fillStyle = darken(hex, 70);
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.42, cy - s * 0.6);
  ctx.lineTo(cx + s * 0.38, cy - s * 0.8);
  ctx.lineTo(cx + s * 0.52, cy - s * 0.62);
  ctx.fill();

  // Horse legs
  ctx.strokeStyle = darken(hex, 60);
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  const legPositions = [-0.35, -0.12, 0.15, 0.35];
  const legAngle = [0.05, -0.1, 0.1, -0.05];
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + s * legPositions[i]!, cy + s * 0.33);
    ctx.lineTo(cx + s * (legPositions[i]! + legAngle[i]!), cy + s * 0.75);
    ctx.stroke();
  }

  // Rider body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.05, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.15, cy - s * 0.1);
  ctx.lineTo(cx + s * 0.1, cy - s * 0.5);
  ctx.lineTo(cx - s * 0.0, cy - s * 0.5);
  ctx.closePath();
  ctx.fill();

  // Rider helmet
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(cx + s * 0.05, cy - s * 0.6, s * 0.15, 0, Math.PI * 2);
  ctx.fill();

  // Lance
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(1.5, size * 0.035);
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.15, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.9);
  ctx.stroke();

  // Banner on lance
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.5, cy - s * 0.9);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.7);
  ctx.lineTo(cx + s * 0.7, cy - s * 0.8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawArtillery(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  const { hex } = safeColor(color);
  const dark = darken(hex, 40);
  const light = lighten(hex, 40);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const s = size * 0.38;

  // Carriage frame
  ctx.fillStyle = darken(hex, 60);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.6, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.2, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.15, cy + s * 0.25);
  ctx.lineTo(cx - s * 0.55, cy + s * 0.25);
  ctx.closePath();
  ctx.fill();

  // Barrel — tapered
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.5, cy - s * 0.15);
  ctx.lineTo(cx + s * 0.55, cy - s * 0.25);
  ctx.lineTo(cx + s * 0.55, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.05);
  ctx.closePath();
  ctx.fill();

  // Barrel reinforcement bands
  ctx.strokeStyle = light;
  ctx.lineWidth = Math.max(1, size * 0.03);
  for (const bx of [-0.2, 0.1, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * bx, cy - s * 0.2);
    ctx.lineTo(cx + s * bx, cy + s * 0.0);
    ctx.stroke();
  }

  // Muzzle flare
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.55, cy - s * 0.32);
  ctx.lineTo(cx + s * 0.72, cy - s * 0.32);
  ctx.lineTo(cx + s * 0.72, cy + s * 0.02);
  ctx.lineTo(cx + s * 0.55, cy + s * 0.02);
  ctx.closePath();
  ctx.fill();

  // Wheel
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  const wheelR = s * 0.32;
  const wheelCx = cx - s * 0.2;
  const wheelCy = cy + s * 0.38;
  ctx.beginPath();
  ctx.arc(wheelCx, wheelCy, wheelR, 0, Math.PI * 2);
  ctx.stroke();
  // Wheel hub
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.arc(wheelCx, wheelCy, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  // Spokes
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, size * 0.025);
  for (let a = 0; a < 6; a++) {
    const angle = (a * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(wheelCx + Math.cos(angle) * s * 0.06, wheelCy + Math.sin(angle) * s * 0.06);
    ctx.lineTo(wheelCx + Math.cos(angle) * wheelR * 0.9, wheelCy + Math.sin(angle) * wheelR * 0.9);
    ctx.stroke();
  }

  // Trail/support
  ctx.strokeStyle = darken(hex, 60);
  ctx.lineWidth = Math.max(1.5, size * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.55, cy + s * 0.15);
  ctx.lineTo(cx - s * 0.9, cy + s * 0.55);
  ctx.stroke();

  // Cannonball stack
  ctx.fillStyle = '#555';
  const ballR = s * 0.08;
  ctx.beginPath();
  ctx.arc(cx + s * 0.35, cy + s * 0.55, ballR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.5, cy + s * 0.55, ballR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + s * 0.425, cy + s * 0.42, ballR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawUnitIcon(ctx: CanvasRenderingContext2D, type: UnitType, cx: number, cy: number, size: number, color: string): void {
  switch (type) {
    case 'infantry': drawInfantry(ctx, cx, cy, size, color); break;
    case 'cavalry': drawCavalry(ctx, cx, cy, size, color); break;
    case 'artillery': drawArtillery(ctx, cx, cy, size, color); break;
  }
}

// Level badge — small shield with number
function drawLevelBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number, level: number, color: string): void {
  const { hex } = safeColor(color);
  const r = 7;
  ctx.save();

  // Shield shape
  ctx.fillStyle = darken(hex, 30);
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.8);
  ctx.lineTo(cx + r, cy - r * 0.8);
  ctx.lineTo(cx + r, cy + r * 0.2);
  ctx.quadraticCurveTo(cx + r, cy + r * 0.8, cx, cy + r);
  ctx.quadraticCurveTo(cx - r, cy + r * 0.8, cx - r, cy + r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = lighten(hex, 60);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Number
  ctx.fillStyle = '#fff';
  ctx.font = monoFont(9, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${level}`, cx, cy);

  ctx.restore();
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
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

// --- Main render ---

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

  // Radial gradient background
  drawRadialGradientBg(ctx, width, height);

  const topPlayer: 1 | 2 = flipped ? 1 : 2;
  const bottomPlayer: 1 | 2 = flipped ? 2 : 1;
  renderStatusBar(rc, state, topPlayer, 0, flipped);
  renderStatusBar(rc, state, bottomPlayer, height - rc.buttonBarHeight - rc.statusBarHeight, flipped);

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

// --- Status Bar ---

function drawApGem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, filled: boolean, color: string): void {
  ctx.save();
  if (filled) {
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    grad.addColorStop(0, lighten(color.startsWith('#') ? color : '#daa520', 60));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
  }
  // Diamond shape
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.7, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.7, cy);
  ctx.closePath();
  ctx.fill();
  if (!filled) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function renderStatusBar(rc: RenderContext, state: GameState, player: Player, y: number, _flipped: boolean): void {
  const { ctx, width } = rc;
  const h = rc.statusBarHeight;
  const isCurrent = player === state.currentPlayer;
  const pColor = playerColor(player);

  // Ornate banner background
  if (isCurrent) {
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(139,115,64,0.12)');
    grad.addColorStop(0.5, `rgba(${player === 1 ? '91,163,217' : '217,79,79'},0.1)`);
    grad.addColorStop(1, 'rgba(139,115,64,0.06)');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
  }
  ctx.fillRect(0, y, width, h);

  // Gold trim lines
  ctx.strokeStyle = isCurrent ? COLORS.gridBorder : 'rgba(139,115,64,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + h - 0.5);
  ctx.lineTo(width, y + h - 0.5);
  ctx.stroke();
  if (y === 0) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  // Player label
  ctx.font = themeFont(16, 'bold');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const labelY = y + h / 2;
  drawTextWithShadow(ctx, `P${player}`, 12, labelY, isCurrent ? pColor : COLORS.textMuted, 'rgba(0,0,0,0.5)', 1);

  if (isCurrent) {
    // AP label
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = themeFont(10, 'normal');
    ctx.fillText('ACTION POINTS', 50, y + h / 2 - 12);

    // AP gems
    const gemR = 8;
    const gemSpacing = 22;
    const gemStartX = 55;
    const gemY = y + h / 2 + 8;
    for (let i = 0; i < state.maxActionPoints; i++) {
      drawApGem(ctx, gemStartX + i * gemSpacing, gemY, gemR, i < state.actionPoints, COLORS.textGold);
    }
  }

  // Turn badge
  ctx.textAlign = 'right';
  ctx.font = themeFont(13, 'bold');
  drawTextWithShadow(ctx, `Turn ${state.turnNumber}`, width - 12, labelY, COLORS.text, 'rgba(0,0,0,0.5)', 1);
}

// --- Reserve Panel ---

function renderReserve(rc: RenderContext, state: GameState, player: Player, y: number, selectedUnitIds: string[] = []): void {
  const { ctx, cellSize, gridOffsetX } = rc;
  const gridWidth = cellSize * GRID_COLS;

  // Ornate frame background
  drawGradientRect(ctx, gridOffsetX, y, gridWidth, rc.reserveHeight, COLORS.panelBgLight, COLORS.reserve);

  // Ornate border
  ctx.strokeStyle = COLORS.gridBorder;
  ctx.lineWidth = 2;
  roundRect(ctx, gridOffsetX, y, gridWidth, rc.reserveHeight, 3);
  ctx.stroke();
  // Inner highlight
  ctx.strokeStyle = COLORS.gridBorderLight;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.3;
  roundRect(ctx, gridOffsetX + 3, y + 3, gridWidth - 6, rc.reserveHeight - 6, 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const reserve = player === 1 ? state.p1Reserve : state.p2Reserve;
  const color = playerColor(player);

  if (reserve.length === 0) return;

  const { iconSize, padding, startX } = getReserveLayout(gridOffsetX, gridWidth, reserve.length, rc.reserveHeight);
  const iconCenterY = y + rc.reserveHeight / 2 - 2;

  reserve.forEach((unit, i) => {
    const cx = startX + i * (iconSize + padding) + iconSize / 2;
    const isSelected = selectedUnitIds.includes(unit.id);
    const unitColor = isSelected ? COLORS.selected : color;

    if (isSelected) {
      // Pulsing glow
      const pulse = 0.6 + 0.4 * Math.sin(animTime * 4);
      ctx.save();
      ctx.shadowColor = COLORS.selectedGlow;
      ctx.shadowBlur = 12 + pulse * 6;
      ctx.fillStyle = COLORS.selectedGlow;
      ctx.globalAlpha = 0.15 + pulse * 0.1;
      ctx.beginPath();
      ctx.arc(cx, iconCenterY, iconSize / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    drawUnitIcon(ctx, unit.type, cx, iconCenterY, iconSize, unitColor);
    // Stacked mini icons showing level
    const miniSize = Math.max(6, iconSize * 0.25);
    const miniSpacing = miniSize * 0.9;
    const miniCount = Math.min(unit.level, 3);
    const miniTotalW = (miniCount - 1) * miniSpacing;
    const miniStartX = cx - miniTotalW / 2;
    const miniY = iconCenterY + iconSize * 0.45;
    for (let lvl = 0; lvl < miniCount; lvl++) {
      drawUnitIcon(ctx, unit.type, miniStartX + lvl * miniSpacing, miniY, miniSize, unitColor);
    }
  });
}

// --- Grid ---

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
  ctx.font = monoFont(fontSize, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  const textWidth = ctx.measureText(text).width;
  const pad = 3;
  const stripH = fontSize + pad * 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  roundRect(ctx, x + (cellSize - textWidth) / 2 - pad, y + cellSize - stripH, textWidth + pad * 2, stripH, 3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x + cellSize / 2, y + cellSize - pad);
}

function drawTopLabel(ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, cellSize: number): void {
  const fontSize = clamp(cellSize * 0.11, 10, 13);
  ctx.font = monoFont(fontSize, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textWidth = ctx.measureText(text).width;
  const pad = 2;
  const stripH = fontSize + pad * 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  roundRect(ctx, x + (cellSize - textWidth) / 2 - pad, y, textWidth + pad * 2, stripH, 3);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(text, x + cellSize / 2, y + pad);
}

function renderInlinePreview(ctx: CanvasRenderingContext2D, preview: SquarePreview, x: number, y: number, cellSize: number): void {
  if (preview.type === 'move') {
    drawBottomLabel(ctx, '1 AP', '#fff', x, y, cellSize);
  } else if (preview.type === 'attack') {
    const totalDice = preview.totalDice ?? 0;
    const meleeDice = preview.meleeDice ?? 0;
    const artDice = preview.artilleryDice ?? 0;
    let diceStr: string;
    if (meleeDice > 0 && artDice > 0) {
      diceStr = `${meleeDice} melee ${artDice} art`;
    } else {
      diceStr = `${totalDice} rolls`;
    }
    const pct = preview.hitChancePct ?? 0;
    const pctColor = pct >= 40 ? '#4caf50' : pct >= 20 ? '#ffeb3b' : '#f44336';
    const text = `${diceStr} ${pct}%`;
    drawBottomLabel(ctx, text, pctColor, x, y, cellSize);
  } else if (preview.type === 'selected') {
    const meleeDice = preview.meleeDice ?? 0;
    const artDice = preview.artilleryDice ?? 0;
    const totalDice = preview.totalDice ?? 0;
    if (totalDice > 0) {
      let diceStr: string;
      if (meleeDice > 0 && artDice > 0) {
        diceStr = `${meleeDice} melee ${artDice} art`;
      } else {
        diceStr = `${totalDice} rolls`;
      }
      drawBottomLabel(ctx, diceStr, '#fff', x, y, cellSize);
    }
    const bonuses = preview.bonuses ?? [];
    if (bonuses.length > 0) {
      const bonusStr = bonuses.map(b => `\u2605${COMPACT_BONUS[b] ?? b}`).join(' ');
      drawTopLabel(ctx, bonusStr, COLORS.textGold, x, y, cellSize);
    }
  }
}

function drawMovePreviewIcon(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number): void {
  // Small boot/arrow icon
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;
  const s = cellSize * 0.12;
  const pulse = 0.7 + 0.3 * Math.sin(animTime * 3);

  ctx.save();
  ctx.globalAlpha = 0.5 * pulse;
  ctx.strokeStyle = '#76ff03';
  ctx.lineWidth = 2;
  // Arrow pointing up
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx + s * 0.7, cy + s * 0.3);
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx - s * 0.7, cy + s * 0.3);
  ctx.moveTo(cx, cy - s);
  ctx.lineTo(cx, cy + s);
  ctx.stroke();
  ctx.restore();
}

function drawAttackPreviewIcon(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number): void {
  // Crosshair
  const cx = x + cellSize / 2;
  const cy = y + cellSize / 2;
  const s = cellSize * 0.15;
  const pulse = 0.7 + 0.3 * Math.sin(animTime * 3);

  ctx.save();
  ctx.globalAlpha = 0.4 * pulse;
  ctx.strokeStyle = '#ff5722';
  ctx.lineWidth = 1.5;
  // Circle
  ctx.beginPath();
  ctx.arc(cx, cy, s, 0, Math.PI * 2);
  ctx.stroke();
  // Cross lines
  ctx.beginPath();
  ctx.moveTo(cx - s * 1.4, cy);
  ctx.lineTo(cx - s * 0.5, cy);
  ctx.moveTo(cx + s * 0.5, cy);
  ctx.lineTo(cx + s * 1.4, cy);
  ctx.moveTo(cx, cy - s * 1.4);
  ctx.lineTo(cx, cy - s * 0.5);
  ctx.moveTo(cx, cy + s * 0.5);
  ctx.lineTo(cx, cy + s * 1.4);
  ctx.stroke();
  ctx.restore();
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
  const gridWidth = cellSize * GRID_COLS;
  const gridHeight = cellSize * GRID_ROWS;

  // Home rows: row 0 = P1, row 3 = P2
  const p1HomeRow = flipped ? GRID_ROWS - 1 : 0;
  const p2HomeRow = flipped ? 0 : GRID_ROWS - 1;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const displayRow = flipped ? GRID_ROWS - 1 - r : r;
      const displayCol = flipped ? GRID_COLS - 1 - c : c;

      const x = gridOffsetX + displayCol * cellSize;
      const y = gridTop + (GRID_ROWS - 1 - displayRow) * cellSize;

      // Checkerboard pattern
      const isAlt = (r + c) % 2 === 1;
      ctx.fillStyle = isAlt ? COLORS.gridBgAlt : COLORS.gridBg;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Home row territory tint
      const dispRowIdx = GRID_ROWS - 1 - displayRow;
      if (dispRowIdx === p1HomeRow) {
        ctx.fillStyle = `rgba(91, 163, 217, 0.06)`;
        ctx.fillRect(x, y, cellSize, cellSize);
      } else if (dispRowIdx === p2HomeRow) {
        ctx.fillStyle = `rgba(217, 79, 79, 0.06)`;
        ctx.fillRect(x, y, cellSize, cellSize);
      }

      // Inner shadow for depth
      const shadowGrad = ctx.createLinearGradient(x, y, x, y + cellSize);
      shadowGrad.addColorStop(0, 'rgba(0,0,0,0.08)');
      shadowGrad.addColorStop(0.1, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(0.9, 'rgba(0,0,0,0)');
      shadowGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(x, y, cellSize, cellSize);

      // Move/attack overlays
      const isMove = validMoves.some(p => p.col === c && p.row === r);
      const isAttack = validAttacks.some(p => p.col === c && p.row === r);

      if (isMove) {
        ctx.fillStyle = COLORS.validMove;
        ctx.fillRect(x, y, cellSize, cellSize);
        // Pulsing border
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.strokeStyle = COLORS.validMoveStroke;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 + pulse * 0.3;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        ctx.globalAlpha = 1;
        drawMovePreviewIcon(ctx, x, y, cellSize);
      }
      if (isAttack) {
        ctx.fillStyle = COLORS.validAttack;
        ctx.fillRect(x, y, cellSize, cellSize);
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.strokeStyle = COLORS.validAttackStroke;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.4 + pulse * 0.3;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        ctx.globalAlpha = 1;
        drawAttackPreviewIcon(ctx, x, y, cellSize);
      }

      // Selected square glow
      if (selectedSquares.some(s => s.col === c && s.row === r)) {
        const pulse = 0.7 + 0.3 * Math.sin(animTime * 4);
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.shadowColor = COLORS.selectedGlow;
        ctx.shadowBlur = 8 * pulse;
        ctx.strokeRect(x + 2, y + 2, cellSize - 4, cellSize - 4);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }

      // Grid lines
      ctx.strokeStyle = COLORS.gridLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Column separator lines
      ctx.save();
      ctx.strokeStyle = COLORS.gridLine;
      ctx.globalAlpha = 0.25;
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

      const preview = squarePreviews.get(`${c},${r}`);
      if (preview) {
        renderInlinePreview(ctx, preview, x, y, cellSize);
      }
    }
  }

  // Ornate grid border
  drawOrnateFrame(ctx, gridOffsetX - 4, gridTop - 4, gridWidth + 8, gridHeight + 8);
}

// --- Unit rendering in grid ---

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
    const baseColor = playerColor(unit.owner);
    const color = isSelected ? COLORS.selected : baseColor;

    // Stack height for this unit
    const stackH = unit.level * iconSize + (unit.level - 1) * gap;
    const startY = y + (cellSize - stackH) / 2;

    if (isSelected) {
      // Pulsing glow around stack
      const pulse = 0.6 + 0.4 * Math.sin(animTime * 4);
      ctx.save();
      ctx.shadowColor = COLORS.selectedGlow;
      ctx.shadowBlur = 10 + pulse * 8;
      ctx.fillStyle = COLORS.selectedGlow;
      ctx.globalAlpha = 0.15 + pulse * 0.1;
      roundRect(ctx, cx - iconSize / 2 - 3, startY - 3, iconSize + 6, stackH + 6, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Draw level-count stacked icons (top to bottom)
    for (let lvl = 0; lvl < unit.level; lvl++) {
      const iconY = startY + lvl * (iconSize + gap) + iconSize / 2;
      drawUnitIcon(ctx, unit.type, cx, iconY, iconSize, color);
    }
  });
}

// --- Attack Result Panel ---

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

  // Screen shake during phase 1
  const shakeIntensity = progress < 0.15 ? (1 - progress / 0.15) * 3 : 0;
  if (shakeIntensity > 0 && result.hits > 0) {
    const shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    const shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
    ctx.save();
    ctx.translate(shakeX, shakeY);
  }

  // Flash target square
  if (progress < 0.4) {
    const flashAlpha = progress < 0.15
      ? progress / 0.15
      : Math.max(0, 1 - (progress - 0.15) / 0.25);
    const { x, y } = gridCellScreen(rc, result.targetSquare, gridTop, flipped);
    ctx.save();
    ctx.fillStyle = result.hits > 0 ? '#ff1744' : '#666';
    ctx.globalAlpha = flashAlpha * 0.7;
    ctx.fillRect(x, y, cellSize, cellSize);
    ctx.restore();
  }

  // Flash attacker squares
  if (progress < 0.3) {
    const flashAlpha = Math.max(0, 1 - progress / 0.3);
    for (const sq of result.attackerSquares) {
      const { x, y } = gridCellScreen(rc, sq, gridTop, flipped);
      ctx.save();
      ctx.fillStyle = COLORS.selectedGlow;
      ctx.globalAlpha = flashAlpha * 0.5;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.restore();
    }
  }

  if (shakeIntensity > 0 && result.hits > 0) {
    ctx.restore();
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

  // Slight scale animation
  const scale = progress < 0.15 ? 0.8 + 0.2 * (progress / 0.15) : progress > 0.8 ? 1 - 0.1 * ((progress - 0.8) / 0.2) : 1;

  const panelW = Math.min(290, width - 32);
  const lineH = 22;
  const bonusLines = result.bonuses.length;
  const damageLines = result.unitDamage.length;
  const panelH = 75 + bonusLines * lineH + (damageLines > 0 ? 26 + damageLines * lineH : 0);
  const panelX = (width - panelW) / 2;

  const target = gridCellScreen(rc, result.targetSquare, gridTop, flipped);
  const targetCenterY = target.y + cellSize / 2;
  let panelY = targetCenterY - panelH - 12;
  if (panelY < 8) panelY = targetCenterY + cellSize + 12;

  // Apply scale from center
  const panelCx = panelX + panelW / 2;
  const panelCy = panelY + panelH / 2;
  ctx.translate(panelCx, panelCy);
  ctx.scale(scale, scale);
  ctx.translate(-panelCx, -panelCy);

  // Panel background with ornate style
  const isHit = result.hits > 0;
  const borderColor = isHit ? '#c44' : COLORS.gridBorder;
  draw9SliceFrame(ctx, panelX, panelY, panelW, panelH, COLORS.panelBg, borderColor);

  let textY = panelY + 22;

  // Sword icon + title
  ctx.font = themeFont(15, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleText = isHit
    ? `\u2694 ATTACK \u2014 ${result.hits} HIT${result.hits !== 1 ? 'S' : ''}!`
    : '\u2694 ATTACK \u2014 MISS!';
  drawTextWithShadow(ctx, titleText, panelX + panelW / 2, textY, isHit ? '#ff8a65' : COLORS.textMuted);
  textY += 28;

  // Dice & threshold
  ctx.fillStyle = '#b0bec5';
  ctx.font = monoFont(13);
  ctx.fillText(
    `${result.totalDice} dice \u00d7 d40  |  threshold \u2264 ${result.threshold}`,
    panelX + panelW / 2,
    textY
  );
  textY += 24;

  // Bonuses
  if (bonusLines > 0) {
    for (const bonus of result.bonuses) {
      ctx.fillStyle = COLORS.textGold;
      ctx.font = themeFont(12);
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
      ctx.font = themeFont(12, 'bold');
      const status = dmg.destroyed ? 'DESTROYED' : `${dmg.damage} dmg`;
      ctx.fillText(status, panelX + panelW / 2, textY);
      textY += lineH;
    }
  }

  ctx.restore();
}

// --- Buttons ---

function renderButtons(rc: RenderContext, _state: GameState): void {
  const { ctx, width, height, buttonBarHeight } = rc;
  const y = height - buttonBarHeight;
  const btnHeight = 42;
  const btnY = y + (buttonBarHeight - btnHeight) / 2;

  // END TURN — ornate button
  const endTurnWidth = width - 110;
  // Gradient fill with bevel
  drawGradientRect(ctx, 8, btnY, endTurnWidth, btnHeight, COLORS.buttonLight, COLORS.buttonDark);
  // Gold border
  ctx.strokeStyle = COLORS.gridBorder;
  ctx.lineWidth = 2;
  roundRect(ctx, 8, btnY, endTurnWidth, btnHeight, 6);
  ctx.stroke();
  // Top bevel highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(12, btnY + 1);
  ctx.lineTo(8 + endTurnWidth - 4, btnY + 1);
  ctx.stroke();

  ctx.fillStyle = COLORS.buttonText;
  ctx.font = themeFont(16, 'bold');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawTextWithShadow(ctx, 'END TURN', 8 + endTurnWidth / 2, btnY + btnHeight / 2, COLORS.buttonText, 'rgba(0,0,0,0.4)', 1);

  // RETREAT — ornate secondary button
  const retreatW = 80;
  const retreatX = width - retreatW - 8;
  drawGradientRect(ctx, retreatX, btnY, retreatW, btnHeight, COLORS.retreatBtnLight, COLORS.retreatBtn);
  ctx.strokeStyle = 'rgba(139,115,64,0.5)';
  ctx.lineWidth = 1;
  roundRect(ctx, retreatX, btnY, retreatW, btnHeight, 6);
  ctx.stroke();

  // Skull-cross icon
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1.5;
  const rcx = retreatX + retreatW / 2;
  const rcy = btnY + btnHeight / 2 - 3;
  ctx.beginPath();
  ctx.moveTo(rcx - 5, rcy - 5);
  ctx.lineTo(rcx + 5, rcy + 5);
  ctx.moveTo(rcx + 5, rcy - 5);
  ctx.lineTo(rcx - 5, rcy + 5);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,200,200,0.7)';
  ctx.font = themeFont(9, 'normal');
  ctx.textAlign = 'center';
  ctx.fillText('retreat', rcx, rcy + 14);
}

// --- Handoff Screen ---

export function renderHandoff(rc: RenderContext, player: Player): void {
  const { ctx, width, height } = rc;

  drawRadialGradientBg(ctx, width, height);

  const pColor = playerColor(player);
  const pLight = playerColorLight(player);

  // Shield emblem
  const shieldSize = Math.min(120, width * 0.3);
  drawShieldEmblem(ctx, width / 2, height / 2 - 40, shieldSize, pColor, pLight);

  // Pulsing glow on shield
  const pulse = 0.5 + 0.5 * Math.sin(animTime * 2);
  ctx.save();
  ctx.globalAlpha = 0.15 + pulse * 0.1;
  ctx.shadowColor = pColor;
  ctx.shadowBlur = 30 + pulse * 20;
  ctx.fillStyle = pColor;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2 - 40, shieldSize * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = themeFont(28, 'bold');
  drawTextWithShadow(ctx, `Pass to Player ${player}`, width / 2, height / 2 + shieldSize * 0.5, COLORS.text, 'rgba(0,0,0,0.6)', 2);

  ctx.font = themeFont(16);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText('Tap to continue', width / 2, height / 2 + shieldSize * 0.5 + 36);
}

// --- Game Over Screen ---

export function renderGameOver(rc: RenderContext, winner: Player): void {
  const { ctx, width, height } = rc;

  drawRadialGradientBg(ctx, width, height);

  const pColor = playerColor(winner);
  const pLight = playerColorLight(winner);

  // Background glow in winner's color
  const glowGrad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, height * 0.4);
  glowGrad.addColorStop(0, `${pColor}30`);
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, width, height);

  // Laurel wreath
  const wreathR = Math.min(80, width * 0.2);
  drawLaurelWreath(ctx, width / 2, height / 2 - 10, wreathR, COLORS.textGold);

  // VICTORY text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = themeFont(36, 'bold');
  drawTextWithShadow(ctx, 'VICTORY', width / 2, height / 2 - 30, COLORS.textGold, 'rgba(0,0,0,0.7)', 3);
  // Second shadow for depth
  drawTextWithShadow(ctx, 'VICTORY', width / 2, height / 2 - 30, COLORS.textGold, pColor + '40', 1);

  ctx.font = themeFont(22, 'bold');
  drawTextWithShadow(ctx, `Player ${winner} Wins!`, width / 2, height / 2 + 20, pLight, 'rgba(0,0,0,0.5)', 2);

  // Particle sparkle effect
  const particleCount = 12;
  for (let i = 0; i < particleCount; i++) {
    const seed = i * 137.5;
    const px = width / 2 + Math.sin(seed + animTime * 0.5) * wreathR * 1.2;
    const baseY = height / 2 + 60;
    const py = baseY - ((animTime * 30 + seed * 2) % 120);
    const alpha = Math.max(0, 1 - ((animTime * 30 + seed * 2) % 120) / 120);
    const sparkleSize = 1.5 + Math.sin(animTime * 5 + i) * 0.8;

    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = COLORS.textGold;
    ctx.beginPath();
    ctx.arc(px, py, sparkleSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Decorative line
  drawDecorativeLine(ctx, width * 0.2, height / 2 + 48, width * 0.6);

  ctx.font = themeFont(14);
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'center';
  ctx.fillText('Tap to play again', width / 2, height / 2 + 72);
}

// --- Scenario Select ---

export function renderScenarioSelect(rc: RenderContext, scenarios: readonly Scenario[]): void {
  const { ctx, width, height } = rc;

  drawRadialGradientBg(ctx, width, height);

  // Title with ornate styling
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = themeFont(26, 'bold');
  const titleY = height * 0.12;
  drawTextWithShadow(ctx, 'IMPERIAL BATTLEGROUND', width / 2, titleY, COLORS.textGold, 'rgba(0,0,0,0.7)', 2);

  // Decorative line
  drawDecorativeLine(ctx, width * 0.15, titleY + 22, width * 0.7);

  // Subtitle
  ctx.font = themeFont(14);
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText('Choose your battle', width / 2, titleY + 44);

  // Cards
  const cardW = Math.min(320, width - 40);
  const cardH = 80;
  const gap = 18;
  const totalH = scenarios.length * cardH + (scenarios.length - 1) * gap;
  const startY = (height - totalH) / 2 + 30;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i]!;
    const cardX = (width - cardW) / 2;
    const cardY = startY + i * (cardH + gap);

    // Ornate card frame
    draw9SliceFrame(ctx, cardX, cardY, cardW, cardH);

    // Scenario name
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = themeFont(18, 'bold');
    drawTextWithShadow(ctx, scenario.name, width / 2, cardY + cardH / 2 - 12, COLORS.text, 'rgba(0,0,0,0.4)', 1);

    // Description
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = themeFont(13);
    ctx.fillText(scenario.description, width / 2, cardY + cardH / 2 + 14);

    // Small unit preview icons
    const previewTypes: UnitType[] = ['infantry', 'cavalry', 'artillery'];
    const previewSize = 16;
    const previewSpacing = 22;
    const previewStartX = width / 2 - (previewTypes.length * previewSpacing) / 2 + previewSpacing / 2;
    const previewY = cardY + cardH / 2 + 30;
    for (let j = 0; j < previewTypes.length; j++) {
      const count = scenario.army.filter(a => a.type === previewTypes[j]).length;
      if (count > 0) {
        drawUnitIcon(ctx, previewTypes[j]!, previewStartX + j * previewSpacing, previewY, previewSize, COLORS.textMuted);
        ctx.fillStyle = COLORS.textMuted;
        ctx.font = monoFont(8);
        ctx.fillText(`${count}`, previewStartX + j * previewSpacing + 10, previewY);
      }
    }
  }
}

export function screenToScenario(rc: RenderContext, x: number, y: number, scenarioCount: number): number | null {
  const { width, height } = rc;
  const cardW = Math.min(320, width - 40);
  const cardH = 80;
  const gap = 18;
  const totalH = scenarioCount * cardH + (scenarioCount - 1) * gap;
  const startY = (height - totalH) / 2 + 30;
  const cardX = (width - cardW) / 2;

  for (let i = 0; i < scenarioCount; i++) {
    const cardY = startY + i * (cardH + gap);
    if (x >= cardX && x <= cardX + cardW && y >= cardY && y <= cardY + cardH) {
      return i;
    }
  }
  return null;
}

// --- Hit testing (preserved exactly) ---

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

    const cellX = screenX - gridOffsetX - displayCol * cellSize;
    const unitIndex = Math.min(2, Math.floor(cellX / (cellSize / 3)));

    return { type: 'grid', pos: { col, row }, unitIndex };
  }

  return null;
}

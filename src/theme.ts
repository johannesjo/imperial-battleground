// src/theme.ts — Design system foundation

export const COLORS = {
  bg: '#0b0c10',
  gridBg: '#1a1f2e',
  gridBgAlt: '#1e2436',
  gridLine: '#3d4a5c',
  gridBorder: '#8b7340',
  gridBorderLight: '#c9a84c',
  p1: '#5ba3d9',
  p1Light: '#7dbde8',
  p1Dark: '#3a7db3',
  p2: '#d94f4f',
  p2Light: '#e87878',
  p2Dark: '#b33a3a',
  selected: '#f0c040',
  selectedGlow: '#ffd54f',
  validMove: 'rgba(76, 175, 80, 0.30)',
  validMoveStroke: 'rgba(76, 175, 80, 0.6)',
  validAttack: 'rgba(255, 100, 50, 0.30)',
  validAttackStroke: 'rgba(255, 100, 50, 0.6)',
  reserve: '#0f1520',
  text: '#e8dcc8',
  textMuted: '#90a4ae',
  textGold: '#daa520',
  textDark: '#333',
  button: '#2a5a1e',
  buttonLight: '#3a7a2e',
  buttonDark: '#1a4010',
  buttonText: '#f0e8d0',
  retreatBtn: '#8b1a1a',
  retreatBtnLight: '#a52a2a',
  panelBg: '#0d1520',
  panelBgLight: '#162030',
} as const;

export function playerColor(player: 1 | 2): string {
  return player === 1 ? COLORS.p1 : COLORS.p2;
}

export function playerColorLight(player: 1 | 2): string {
  return player === 1 ? COLORS.p1Light : COLORS.p2Light;
}

export function playerColorDark(player: 1 | 2): string {
  return player === 1 ? COLORS.p1Dark : COLORS.p2Dark;
}

// Font helpers
const FONT_FAMILY = '"Cinzel", "Palatino Linotype", "Book Antiqua", Palatino, serif';
const MONO_FAMILY = '"Fira Code", "Cascadia Code", Consolas, monospace';

export function themeFont(size: number, weight: 'normal' | 'bold' = 'normal'): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

export function monoFont(size: number, weight: 'normal' | 'bold' = 'normal'): string {
  return `${weight} ${size}px ${MONO_FAMILY}`;
}

// Drawing utilities

export function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  shadowColor = 'rgba(0,0,0,0.6)',
  shadowOffset = 2,
): void {
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

export function drawGradientRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colorTop: string,
  colorBottom: string,
): void {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

export function drawOrnateFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lineColor = COLORS.gridBorder,
  highlightColor = COLORS.gridBorderLight,
): void {
  ctx.save();

  // Outer border
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);

  // Inner border
  const inset = 4;
  ctx.strokeStyle = highlightColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2);

  // Corner flourishes — small diamond shapes
  const cornerSize = 6;
  const corners = [
    { cx: x, cy: y },
    { cx: x + w, cy: y },
    { cx: x, cy: y + h },
    { cx: x + w, cy: y + h },
  ];

  ctx.fillStyle = highlightColor;
  for (const { cx, cy } of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - cornerSize);
    ctx.lineTo(cx + cornerSize, cy);
    ctx.lineTo(cx, cy + cornerSize);
    ctx.lineTo(cx - cornerSize, cy);
    ctx.closePath();
    ctx.fill();
  }

  // Small cross accents at midpoints of each edge
  const crossSize = 3;
  ctx.strokeStyle = highlightColor;
  ctx.lineWidth = 1.5;
  const midpoints = [
    { cx: x + w / 2, cy: y },         // top
    { cx: x + w / 2, cy: y + h },     // bottom
    { cx: x, cy: y + h / 2 },         // left
    { cx: x + w, cy: y + h / 2 },     // right
  ];
  for (const { cx, cy } of midpoints) {
    ctx.beginPath();
    ctx.moveTo(cx - crossSize, cy);
    ctx.lineTo(cx + crossSize, cy);
    ctx.moveTo(cx, cy - crossSize);
    ctx.lineTo(cx, cy + crossSize);
    ctx.stroke();
  }

  ctx.restore();
}

export function draw9SliceFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor: string = COLORS.panelBg,
  borderColor: string = COLORS.gridBorder,
): void {
  ctx.save();

  // Fill background with subtle gradient
  drawGradientRect(ctx, x, y, w, h, COLORS.panelBgLight, bgColor);

  // Outer border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();

  // Inner highlight line
  ctx.strokeStyle = COLORS.gridBorderLight;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.4;
  roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 4);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
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

export function drawRadialGradientBg(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.max(width, height) * 0.7;
  const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
  grad.addColorStop(0, '#151a28');
  grad.addColorStop(0.5, '#0f1018');
  grad.addColorStop(1, COLORS.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

// Procedural laurel wreath for victory screen
export function drawLaurelWreath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';

  const leafCount = 8;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < leafCount; i++) {
      const angle = (Math.PI * 0.3) + (i / leafCount) * Math.PI * 0.55;
      const lx = cx + Math.cos(angle) * radius * side;
      const ly = cy - Math.sin(angle) * radius;

      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(-angle * side + Math.PI / 2);

      // Leaf shape
      const leafLen = radius * 0.22;
      const leafWidth = radius * 0.08;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(leafWidth * side, -leafLen * 0.5, 0, -leafLen);
      ctx.quadraticCurveTo(-leafWidth * side, -leafLen * 0.5, 0, 0);
      ctx.fill();

      ctx.restore();
    }

    // Stem
    ctx.beginPath();
    ctx.moveTo(cx + side * radius * 0.15, cy + radius * 0.3);
    for (let i = 0; i <= leafCount; i++) {
      const t = i / leafCount;
      const angle = (Math.PI * 0.3) + t * Math.PI * 0.55;
      const lx = cx + Math.cos(angle) * radius * 0.85 * side;
      const ly = cy - Math.sin(angle) * radius * 0.85;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// Shield emblem for handoff screen
export function drawShieldEmblem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string,
  colorLight: string,
): void {
  ctx.save();
  const w = size * 0.7;
  const h = size;

  // Shield shape
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h * 0.35);
  ctx.lineTo(cx - w / 2, cy + h * 0.1);
  ctx.quadraticCurveTo(cx - w / 2, cy + h * 0.4, cx, cy + h * 0.5);
  ctx.quadraticCurveTo(cx + w / 2, cy + h * 0.4, cx + w / 2, cy + h * 0.1);
  ctx.lineTo(cx + w / 2, cy - h * 0.35);
  ctx.closePath();

  // Gradient fill
  const grad = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  grad.addColorStop(0, colorLight);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fill();

  // Border
  ctx.strokeStyle = COLORS.gridBorderLight;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Cross emblem
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = size * 0.06;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.25);
  ctx.lineTo(cx, cy + h * 0.25);
  ctx.moveTo(cx - w * 0.25, cy - h * 0.05);
  ctx.lineTo(cx + w * 0.25, cy - h * 0.05);
  ctx.stroke();

  ctx.restore();
}

// Decorative line separator
export function drawDecorativeLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  color = COLORS.gridBorder,
): void {
  ctx.save();
  const cx = x + width / 2;

  // Main line with gradient fade
  const grad = ctx.createLinearGradient(x, y, x + width, y);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.2, color);
  grad.addColorStop(0.5, COLORS.gridBorderLight);
  grad.addColorStop(0.8, color);
  grad.addColorStop(1, 'transparent');

  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();

  // Center diamond
  const diamondSize = 4;
  ctx.fillStyle = COLORS.gridBorderLight;
  ctx.beginPath();
  ctx.moveTo(cx, y - diamondSize);
  ctx.lineTo(cx + diamondSize, y);
  ctx.lineTo(cx, y + diamondSize);
  ctx.lineTo(cx - diamondSize, y);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

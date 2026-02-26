// src/input.ts
import type { RenderContext } from './renderer';
import { screenToGrid } from './renderer';

export type GameAction =
  | { type: 'selectGrid'; col: number; row: number; unitIndex: number }
  | { type: 'selectReserve'; player: 1 | 2; unitIndex: number }
  | { type: 'endTurn' }
  | { type: 'retreat' }
  | { type: 'tap'; x: number; y: number };

export function setupInput(
  canvas: HTMLCanvasElement,
  getRc: () => RenderContext,
  flipped: () => boolean,
  onAction: (action: GameAction) => void,
  getReserveCounts?: () => { p1: number; p2: number },
  rawTapOnly?: () => boolean
): void {
  function handlePointer(e: PointerEvent) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    // Convert to CSS pixel space (matches rendering coordinate system)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (rawTapOnly?.()) {
      onAction({ type: 'tap', x, y });
      return;
    }

    const hit = screenToGrid(getRc(), x, y, flipped(), getReserveCounts?.());

    if (!hit) {
      onAction({ type: 'tap', x, y });
      return;
    }

    switch (hit.type) {
      case 'grid':
        onAction({ type: 'selectGrid', col: hit.pos.col, row: hit.pos.row, unitIndex: hit.unitIndex });
        break;
      case 'reserve':
        onAction({ type: 'selectReserve', player: hit.player, unitIndex: hit.unitIndex });
        break;
      case 'endTurn':
        onAction({ type: 'endTurn' });
        break;
      case 'retreat':
        onAction({ type: 'retreat' });
        break;
    }
  }

  canvas.addEventListener('pointerdown', handlePointer);
}

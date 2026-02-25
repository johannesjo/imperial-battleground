// src/input.ts
import type { RenderContext } from './renderer';
import { screenToGrid } from './renderer';

export type GameAction =
  | { type: 'selectGrid'; col: number; row: number; unitIndex: number }
  | { type: 'selectReserve'; player: 1 | 2 }
  | { type: 'endTurn' }
  | { type: 'retreat' }
  | { type: 'tap' };

export function setupInput(
  canvas: HTMLCanvasElement,
  getRc: () => RenderContext,
  flipped: () => boolean,
  onAction: (action: GameAction) => void,
  onHover?: (pos: { col: number; row: number } | null) => void
): void {
  function handlePointer(e: PointerEvent) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const hit = screenToGrid(getRc(), x, y, flipped());

    if (!hit) {
      onAction({ type: 'tap' });
      return;
    }

    switch (hit.type) {
      case 'grid':
        onAction({ type: 'selectGrid', col: hit.pos.col, row: hit.pos.row, unitIndex: hit.unitIndex });
        break;
      case 'reserve':
        onAction({ type: 'selectReserve', player: hit.player });
        break;
      case 'endTurn':
        onAction({ type: 'endTurn' });
        break;
      case 'retreat':
        onAction({ type: 'retreat' });
        break;
    }
  }

  function handleMove(e: PointerEvent) {
    if (!onHover) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const hit = screenToGrid(getRc(), x, y, flipped());
    if (hit?.type === 'grid') {
      onHover({ col: hit.pos.col, row: hit.pos.row });
    } else {
      onHover(null);
    }
  }

  canvas.addEventListener('pointerdown', handlePointer);
  canvas.addEventListener('pointermove', handleMove);
}

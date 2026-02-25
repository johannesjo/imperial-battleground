// src/input.ts
import type { RenderContext } from './renderer';
import { screenToGrid } from './renderer';

export type GameAction =
  | { type: 'selectGrid'; col: number; row: number }
  | { type: 'selectReserve'; player: 1 | 2 }
  | { type: 'endTurn' }
  | { type: 'retreat' }
  | { type: 'tap' };

export function setupInput(
  canvas: HTMLCanvasElement,
  rc: RenderContext,
  flipped: () => boolean,
  onAction: (action: GameAction) => void
): void {
  function handlePointer(e: PointerEvent) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const hit = screenToGrid(rc, x, y, flipped());

    if (!hit) {
      onAction({ type: 'tap' });
      return;
    }

    switch (hit.type) {
      case 'grid':
        onAction({ type: 'selectGrid', col: hit.pos.col, row: hit.pos.row });
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

  canvas.addEventListener('pointerdown', handlePointer);
}

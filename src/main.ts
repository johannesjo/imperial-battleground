// src/main.ts
import type { GameState, Position } from './types';
import { createInitialState, getSquare, getReserve, getHomeRow } from './game-state';
import { getValidMoves, getValidAttacks, canDeploy } from './rules';
import { deployUnit, moveUnit, attackSquare, endTurn, confirmHandoff, checkWinCondition } from './actions';
import { createRenderContext, render, renderHandoff, renderGameOver } from './renderer';
import { setupInput } from './input';
import type { GameAction } from './input';
import { GRID_COLS } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

let state: GameState = createInitialState();
let selectedUnitId: string | null = null;
let validMoves: Position[] = [];
let validAttacks: Position[] = [];
let deployMode = false;

let rc = createRenderContext(canvas);

// Recreate render context on resize
window.addEventListener('resize', () => {
  resize();
  rc = createRenderContext(canvas);
  draw();
});

function isFlipped(): boolean {
  return state.currentPlayer === 2;
}

function clearSelection() {
  selectedUnitId = null;
  validMoves = [];
  validAttacks = [];
  deployMode = false;
  state = { ...state, selectedSquare: null };
}

function handleAction(action: GameAction) {
  if (state.phase === 'game-over') {
    if (action.type === 'tap' || action.type === 'selectGrid' || action.type === 'selectReserve') {
      state = createInitialState();
      clearSelection();
    }
    draw();
    return;
  }

  if (state.phase === 'handoff') {
    if (action.type === 'tap' || action.type === 'selectGrid' || action.type === 'selectReserve') {
      state = confirmHandoff(state);
      clearSelection();
    }
    draw();
    return;
  }

  switch (action.type) {
    case 'selectReserve': {
      if (action.player !== state.currentPlayer) break;
      if (state.actionPoints <= 0) break;
      const reserve = getReserve(state, state.currentPlayer);
      if (reserve.length === 0) break;

      deployMode = true;
      selectedUnitId = reserve[0]!.id;
      validMoves = [];
      validAttacks = [];

      const homeRow = getHomeRow(state.currentPlayer);
      for (let c = 0; c < GRID_COLS; c++) {
        const pos = { col: c, row: homeRow };
        if (canDeploy(state, state.currentPlayer, pos)) {
          validMoves.push(pos);
        }
      }
      state = { ...state, selectedSquare: null };
      break;
    }

    case 'selectGrid': {
      const pos: Position = { col: action.col, row: action.row };

      // If in deploy mode, try to deploy
      if (deployMode && selectedUnitId) {
        if (validMoves.some(m => m.col === pos.col && m.row === pos.row)) {
          state = deployUnit(state, selectedUnitId, pos);
          clearSelection();
          const winner = checkWinCondition(state);
          if (winner) state = { ...state, phase: 'game-over', winner };
          break;
        }
        clearSelection();
        break;
      }

      // If a unit is selected and tapping a valid move target
      if (selectedUnitId && validMoves.some(m => m.col === pos.col && m.row === pos.row)) {
        const from = state.selectedSquare!;
        state = moveUnit(state, selectedUnitId, from, pos);
        clearSelection();
        break;
      }

      // If tapping a valid attack target
      if (state.selectedSquare && validAttacks.some(a => a.col === pos.col && a.row === pos.row)) {
        const result = attackSquare(state, [state.selectedSquare], pos);
        state = result.state;
        clearSelection();
        const winner = checkWinCondition(state);
        if (winner) state = { ...state, phase: 'game-over', winner };
        break;
      }

      // Otherwise, select this square
      const sq = getSquare(state, pos);
      if (sq && sq.units.some(u => u.owner === state.currentPlayer)) {
        state = { ...state, selectedSquare: pos };
        const myUnits = sq.units.filter(u => u.owner === state.currentPlayer);
        const firstMovable = myUnits.find(u => !u.hasMoved);

        if (firstMovable) {
          selectedUnitId = firstMovable.id;
          validMoves = getValidMoves(state, firstMovable, pos);
        } else {
          selectedUnitId = null;
          validMoves = [];
        }

        validAttacks = getValidAttacks(state, pos);
      } else {
        clearSelection();
      }
      break;
    }

    case 'endTurn': {
      state = endTurn(state);
      clearSelection();
      break;
    }

    case 'retreat': {
      const winner: 1 | 2 = state.currentPlayer === 1 ? 2 : 1;
      state = { ...state, phase: 'game-over', winner };
      clearSelection();
      break;
    }

    case 'tap':
      clearSelection();
      break;
  }

  draw();
}

function draw() {
  if (state.phase === 'handoff') {
    renderHandoff(rc, state.currentPlayer);
    return;
  }
  if (state.phase === 'game-over' && state.winner) {
    renderGameOver(rc, state.winner);
    return;
  }
  render(rc, state, validMoves, validAttacks, isFlipped());
}

setupInput(canvas, rc, isFlipped, handleAction);
draw();

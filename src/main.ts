// src/main.ts
import type { AttackResult, GameState, Position, PreviewInfo, Unit } from './types';
import { createInitialState, getSquare, getReserve, getHomeRow } from './game-state';
import { getValidMoves, getValidGroupMoves, getValidAttacks, canDeploy } from './rules';
import { deployUnit, moveUnit, moveUnits, attackSquare, endTurn, confirmHandoff, checkWinCondition } from './actions';
import { calculateBonuses, calculateThreshold } from './combat';
import { createRenderContext, render, renderHandoff, renderGameOver } from './renderer';
import { setupInput } from './input';
import type { GameAction } from './input';
import { GRID_COLS, D40 } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
resize();

let state: GameState = createInitialState();
let selectedUnitIds: string[] = [];
let selectedSquares: Position[] = [];
let validMoves: Position[] = [];
let validAttacks: Position[] = [];
let deployMode = false;
let lastAttackResult: AttackResult | null = null;
let attackAnimStart = 0;
const ATTACK_ANIM_DURATION = 2000;

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

function samePos(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

function clearSelection() {
  selectedUnitIds = [];
  selectedSquares = [];
  validMoves = [];
  validAttacks = [];
  deployMode = false;
  state = { ...state, selectedSquare: null };
}

function recalcMoves(): void {
  if (selectedUnitIds.length === 0 || selectedSquares.length === 0) {
    validMoves = [];
    return;
  }
  if (selectedUnitIds.length === 1) {
    const onlyId = selectedUnitIds[0]!;
    const onlySq = selectedSquares[0]!;
    const onlyUnit = getSquare(state, onlySq)?.units.find(u => u.id === onlyId);
    validMoves = onlyUnit && !onlyUnit.hasMoved ? getValidMoves(state, onlyUnit, onlySq) : [];
    return;
  }
  // Multi-unit: only if all from same square
  if (selectedSquares.length !== 1) {
    validMoves = [];
    return;
  }
  const sq = getSquare(state, selectedSquares[0]!);
  if (!sq) { validMoves = []; return; }
  const units = selectedUnitIds.map(id => sq.units.find(u => u.id === id)).filter((u): u is typeof sq.units[number] => !!u);
  if (units.length !== selectedUnitIds.length) { validMoves = []; return; }
  validMoves = getValidGroupMoves(state, units, selectedSquares[0]!);
}

function recalcAttacks(): void {
  if (selectedUnitIds.length === 0) { validAttacks = []; return; }

  // Intersection: only targets every selected unit can attack
  let result: Position[] | null = null;
  for (const sq of selectedSquares) {
    for (const uid of selectedUnitIds) {
      const targets = getValidAttacks(state, sq, uid);
      if (result === null) {
        result = [...targets];
      } else {
        result = result.filter(r => targets.some(t => samePos(r, t)));
      }
    }
  }
  validAttacks = result ?? [];
}

function computePreview(): PreviewInfo | null {
  if (selectedUnitIds.length === 0) return null;

  // Gather selected units
  const selectedUnits: Unit[] = [];
  for (const sq of selectedSquares) {
    const square = getSquare(state, sq);
    if (!square) continue;
    for (const unit of square.units) {
      if (selectedUnitIds.includes(unit.id)) {
        selectedUnits.push(unit);
      }
    }
  }

  if (selectedUnits.length === 0) return null;

  if (validAttacks.length > 0) {
    // Build attackersBySquare map for bonus calculation
    const attackersBySquare = new Map<string, Unit[]>();
    for (const sq of selectedSquares) {
      const square = getSquare(state, sq);
      if (!square) continue;
      const key = `${sq.col},${sq.row}`;
      const units = square.units.filter(u => selectedUnitIds.includes(u.id));
      if (units.length > 0) {
        attackersBySquare.set(key, units);
      }
    }

    const bonuses = calculateBonuses(attackersBySquare);
    const threshold = calculateThreshold(bonuses);
    const totalDice = selectedUnits.reduce((sum, u) => sum + u.level, 0);
    const hitChance = threshold / D40;

    return {
      type: 'attack',
      selectedUnits,
      totalDice,
      bonuses,
      threshold,
      hitChance,
    };
  }

  if (validMoves.length > 0) {
    return {
      type: 'move',
      selectedUnits,
      unitCount: selectedUnits.length,
      isGroupMove: selectedUnits.length > 1,
    };
  }

  return null;
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
      selectedUnitIds = [reserve[0]!.id];
      selectedSquares = [];
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
      if (deployMode && selectedUnitIds.length === 1) {
        if (validMoves.some(m => m.col === pos.col && m.row === pos.row)) {
          state = deployUnit(state, selectedUnitIds[0]!, pos);
          clearSelection();
          const winner = checkWinCondition(state);
          if (winner) state = { ...state, phase: 'game-over', winner };
          break;
        }
        clearSelection();
        break;
      }

      // If units selected and tapping a valid move target
      // If tapping directly on a friendly unit in that cell, fall through to selection
      if (selectedUnitIds.length >= 1 && selectedSquares.length === 1 && validMoves.some(m => samePos(m, pos))) {
        const targetSq = getSquare(state, pos);
        const friendlyUnits = targetSq?.units.filter(u => u.owner === state.currentPlayer) ?? [];
        const tappedExistingUnit = friendlyUnits[action.unitIndex];
        if (!tappedExistingUnit) {
          if (selectedUnitIds.length === 1) {
            state = moveUnit(state, selectedUnitIds[0]!, selectedSquares[0]!, pos);
          } else {
            state = moveUnits(state, selectedUnitIds, selectedSquares[0]!, pos);
          }
          clearSelection();
          break;
        }
        // Tapped on an existing unit — fall through to select it
      }

      // If tapping a valid attack target — only the selected unit attacks
      if (selectedSquares.length > 0 && validAttacks.some(a => samePos(a, pos))) {
        const attackUnitIds = selectedUnitIds.length > 0 ? selectedUnitIds : undefined;
        const result = attackSquare(state, selectedSquares, pos, attackUnitIds);
        state = result.state;
        lastAttackResult = result.attackResult;
        attackAnimStart = performance.now();
        clearSelection();
        const winner = checkWinCondition(state);
        if (winner) state = { ...state, phase: 'game-over', winner };
        startAttackAnim();
        break;
      }

      // Clicking a square with friendly units — require tapping a specific unit
      const sq = getSquare(state, pos);
      const myUnits = sq?.units.filter(u => u.owner === state.currentPlayer) ?? [];
      const tappedUnit = myUnits[action.unitIndex];

      if (tappedUnit) {
        // Toggle unit in/out of selection
        const idx = selectedUnitIds.indexOf(tappedUnit.id);
        if (idx >= 0) {
          // Deselect this unit
          selectedUnitIds.splice(idx, 1);
          if (selectedUnitIds.length === 0) {
            clearSelection();
            break;
          }
          // Remove square if no selected units remain on it
          const sqUnits = sq?.units.filter(u => selectedUnitIds.includes(u.id)) ?? [];
          if (sqUnits.length === 0) {
            selectedSquares = selectedSquares.filter(s => !samePos(s, pos));
          }
        } else {
          // Add this unit to selection
          selectedUnitIds.push(tappedUnit.id);
          if (!selectedSquares.some(s => samePos(s, pos))) {
            selectedSquares.push(pos);
          }
        }

        recalcMoves();
        recalcAttacks();
        state = { ...state, selectedSquare: selectedSquares[0] ?? null };
      } else {
        // Tapped empty space — deselect
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

function attackAnimProgress(): number {
  if (!lastAttackResult) return 0;
  const elapsed = performance.now() - attackAnimStart;
  return Math.min(1, elapsed / ATTACK_ANIM_DURATION);
}

function startAttackAnim(): void {
  function tick() {
    draw();
    if (attackAnimProgress() < 1) {
      requestAnimationFrame(tick);
    } else {
      lastAttackResult = null;
      draw();
    }
  }
  requestAnimationFrame(tick);
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
  const animProgress = lastAttackResult ? attackAnimProgress() : 0;
  const preview = computePreview();
  render(rc, state, validMoves, validAttacks, isFlipped(), selectedUnitIds, selectedSquares, lastAttackResult, animProgress, preview);
}

setupInput(canvas, () => rc, isFlipped, handleAction);
draw();

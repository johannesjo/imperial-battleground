// src/main.ts
import type { AttackResult, BonusType, GameState, Position, SquarePreview, Unit } from './types';
import { createInitialState, getSquare, getReserve, getHomeRow } from './game-state';
import { getValidMoves, getValidGroupMoves, getValidAttacks, canDeploy } from './rules';
import { deployUnit, moveUnit, moveUnits, attackSquare, endTurn, confirmHandoff, checkWinCondition } from './actions';
import { calculateBonuses, calculateThreshold, getArtilleryThreshold } from './combat';
import { createRenderContext, render, renderHandoff, renderGameOver, renderScenarioSelect, screenToScenario, setAnimTime } from './renderer';
import { setupInput } from './input';
import type { GameAction } from './input';
import { GRID_COLS, D40, ARTILLERY_VULNERABILITY_THRESHOLD, SCENARIOS } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
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
let squarePreviews = new Map<string, SquarePreview>();

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
  squarePreviews = new Map();
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

  // Intersection: only targets reachable by ALL selected units
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

function computeSquarePreviews(): void {
  squarePreviews = new Map();

  for (const m of validMoves) {
    squarePreviews.set(`${m.col},${m.row}`, { type: 'move', apCost: 1 });
  }

  if (selectedUnitIds.length === 0) return;

  // Build attackersBySquare for bonus/threshold calculation
  const attackersBySquare = new Map<string, Unit[]>();
  for (const sq of selectedSquares) {
    const square = getSquare(state, sq);
    if (!square) continue;
    const key = `${sq.col},${sq.row}`;
    const units = square.units.filter(u => selectedUnitIds.includes(u.id));
    if (units.length > 0) attackersBySquare.set(key, units);
  }

  const allAttackers = [...attackersBySquare.values()].flat();
  const bonuses: BonusType[] = validAttacks.length > 0 ? calculateBonuses(attackersBySquare) : [];
  const baseThreshold = validAttacks.length > 0 ? calculateThreshold(bonuses) : 0;

  const meleeUnits = allAttackers.filter(u => u.type !== 'artillery');
  const artilleryUnits = allAttackers.filter(u => u.type === 'artillery');
  const meleeDice = meleeUnits.reduce((sum, u) => sum + u.level, 0);
  const artDice = artilleryUnits.reduce((sum, u) => sum + u.level, 0);
  const totalDice = meleeDice + artDice;

  // Selected square entries (show dice + bonuses on the attacker's own square)
  if (validAttacks.length > 0) {
    for (const sq of selectedSquares) {
      squarePreviews.set(`${sq.col},${sq.row}`, {
        type: 'selected',
        totalDice,
        meleeDice,
        artilleryDice: artDice,
        bonuses,
      });
    }
  }

  for (const target of validAttacks) {
    // Determine which selected units can individually reach this target
    const reachableBySquare = new Map<string, Unit[]>();
    for (const sq of selectedSquares) {
      const square = getSquare(state, sq);
      if (!square) continue;
      const key = `${sq.col},${sq.row}`;
      const units = square.units.filter(u => selectedUnitIds.includes(u.id));
      const reachable = units.filter(u => {
        const targets = getValidAttacks(state, sq, u.id);
        return targets.some(t => t.col === target.col && t.row === target.row);
      });
      if (reachable.length > 0) reachableBySquare.set(key, reachable);
    }

    const reachableAttackers = [...reachableBySquare.values()].flat();
    const tMeleeUnits = reachableAttackers.filter(u => u.type !== 'artillery');
    const tArtUnits = reachableAttackers.filter(u => u.type === 'artillery');
    const tMeleeDice = tMeleeUnits.reduce((sum, u) => sum + u.level, 0);
    const tArtDice = tArtUnits.reduce((sum, u) => sum + u.level, 0);
    const tTotalDice = tMeleeDice + tArtDice;

    // Bonuses based on units that can reach this target
    const tBonuses = reachableBySquare.size > 0 ? calculateBonuses(reachableBySquare) : [];
    const tBaseThreshold = tBonuses.length > 0 ? calculateThreshold(tBonuses) : calculateThreshold([]);

    const targetSq = getSquare(state, { col: target.col, row: target.row });
    const defenders = targetSq?.units.filter(u => u.owner !== state.currentPlayer) ?? [];

    // Artillery vulnerability: +4 threshold when target has artillery defenders
    const hasArtDefenders = defenders.some(u => u.type === 'artillery');
    const threshold = hasArtDefenders
      ? Math.min(tBaseThreshold + ARTILLERY_VULNERABILITY_THRESHOLD, 36)
      : tBaseThreshold;

    const meleeChance = tMeleeDice > 0 ? threshold / D40 : 0;

    // Artillery: distance-based threshold per source square
    let artChance = 0;
    if (tArtDice > 0) {
      for (const [key] of reachableBySquare) {
        const hasArt = reachableBySquare.get(key)!.some(u => u.type === 'artillery');
        if (hasArt) {
          const artRow = parseInt(key.split(',')[1]!);
          const distance = Math.abs(target.row - artRow);
          artChance = getArtilleryThreshold(distance) / D40;
          break;
        }
      }
    }

    // Weighted average hit chance
    let hitChancePct: number;
    if (tTotalDice > 0) {
      hitChancePct = Math.round(((tMeleeDice * meleeChance + tArtDice * artChance) / tTotalDice) * 100);
    } else {
      hitChancePct = 0;
    }

    squarePreviews.set(`${target.col},${target.row}`, {
      type: 'attack',
      hitChancePct,
      totalDice: tTotalDice,
      meleeDice: tMeleeDice,
      artilleryDice: tArtDice,
    });
  }
}

function handleAction(action: GameAction) {
  if (state.phase === 'scenario-select') {
    if (action.type === 'tap') {
      const idx = screenToScenario(rc, action.x, action.y, SCENARIOS.length);
      if (idx != null) {
        state = createInitialState(SCENARIOS[idx]);
        clearSelection();
      }
    }
    draw();
    return;
  }

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

      const reserveUnit = reserve[action.unitIndex] ?? reserve[0]!;
      deployMode = true;
      selectedUnitIds = [reserveUnit.id];
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
      computeSquarePreviews();
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
        computeSquarePreviews();
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
  if (needsAnimation()) startAnimLoop();
}

function attackAnimProgress(): number {
  if (!lastAttackResult) return 0;
  const elapsed = performance.now() - attackAnimStart;
  return Math.min(1, elapsed / ATTACK_ANIM_DURATION);
}

function startAttackAnim(): void {
  startAnimLoop();
}

// --- Animation loop ---
// Runs only when something is animating (selection glow, attack anim, handoff/gameover effects)
let animLoopRunning = false;

function needsAnimation(): boolean {
  if (lastAttackResult) return true;
  if (selectedUnitIds.length > 0) return true;
  if (validMoves.length > 0 || validAttacks.length > 0) return true;
  if (state.phase === 'handoff') return true;
  if (state.phase === 'game-over') return true;
  if (state.phase === 'scenario-select') return true;
  return false;
}

function startAnimLoop(): void {
  if (animLoopRunning) return;
  animLoopRunning = true;
  requestAnimationFrame(animTick);
}

function stopAnimLoop(): void {
  animLoopRunning = false;
}

function animTick(timestamp: number): void {
  if (!animLoopRunning) return;

  setAnimTime(timestamp / 1000);

  // Check if attack anim is done
  if (lastAttackResult && attackAnimProgress() >= 1) {
    lastAttackResult = null;
  }

  draw();

  if (needsAnimation()) {
    requestAnimationFrame(animTick);
  } else {
    animLoopRunning = false;
  }
}

function draw() {
  setAnimTime(performance.now() / 1000);
  if (state.phase === 'scenario-select') {
    renderScenarioSelect(rc, SCENARIOS);
    return;
  }
  if (state.phase === 'handoff') {
    renderHandoff(rc, state.currentPlayer);
    return;
  }
  if (state.phase === 'game-over' && state.winner) {
    renderGameOver(rc, state.winner);
    return;
  }
  const animProgress = lastAttackResult ? attackAnimProgress() : 0;
  render(rc, state, validMoves, validAttacks, isFlipped(), selectedUnitIds, selectedSquares, lastAttackResult, animProgress, squarePreviews);
}

setupInput(canvas, () => rc, isFlipped, handleAction, () => ({
  p1: state.p1Reserve.length,
  p2: state.p2Reserve.length,
}), () => state.phase === 'scenario-select');
draw();
// Start animation loop for initial screen (scenario select has subtle effects)
startAnimLoop();

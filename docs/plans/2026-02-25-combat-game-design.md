# Imperial Battleground — Game Design Document

A mobile-first, two-player hot-seat tactical combat game inspired by the battle system from Conquest of the New World (Interplay, 1996).

## Core Concept

Turn-based tactical combat on a small grid. Two players share one device, taking turns deploying units, maneuvering, and attacking. Pure skill — identical armies, no hidden information.

---

## Battlefield

### Grid Layout

3 columns × 4 rows playable grid, plus a 3×1 reserve/flag zone at each end.

```
     Col 0    Col 1    Col 2
    ┌────────┬────────┬────────┐
    │   P2 RESERVES / FLAG     │  Reserve zone (deploy from here)
    ├────────┼────────┼────────┤
R3  │        │        │        │  P2 home row
R2  │        │        │        │
R1  │        │        │        │
R0  │        │        │        │  P1 home row
    ├────────┼────────┼────────┤
    │   P1 RESERVES / FLAG     │  Reserve zone (deploy from here)
    └────────┴────────┴────────┘
```

- **Reserve zones** are not part of the playable grid but are visible and interactive.
- Each reserve zone holds a player's undeployed units and their flag.
- Entering the opponent's reserve zone captures their flag (win condition).

---

## Units

### Unit Types

| Unit | Symbol | Move Range | Move Constraint | Attack Range | Stack Cost | Special |
|------|--------|-----------|-----------------|-------------|------------|---------|
| Infantry | ■ | 1 orthogonal | Any row | Adjacent orthogonal | 1 slot | Move OR attack (not both) |
| Cavalry | ▲ | Up to 2 orthogonal | Any row | Adjacent orthogonal | 2 slots | Move 1 + attack (charge), OR move 2 (no attack) |
| Artillery | ● | 1 orthogonal | Home row only | Any square in same column | 2 slots | Move OR fire (not both) |

### Unit Levels

Each unit has a level (1–5):
- Level = HP (hit points remaining)
- Level = number of attack dice rolled
- When level reaches 0, the unit is destroyed

### Stacking

- Each square holds a maximum of **6 slots**.
- Infantry = 1 slot, Cavalry = 2 slots, Artillery = 2 slots.
- Multiple unit types can share a square within the slot limit.

### Starting Army (Mirror)

Both players start with identical armies in their reserve zone:
- 3 Infantry (level 2)
- 2 Cavalry (level 2)
- 1 Artillery (level 2)
- Total: 11 slots

---

## Turn Structure

### Action Points

Each player has **6 AP per turn**. Each action costs 1 AP:
- **Deploy** a unit from reserves onto the home row
- **Move** a unit on the grid
- **Attack** with all units in one square targeting one enemy square

Unspent AP is lost at end of turn.

### Turn Flow

```
1. Active player's turn begins (6 AP)
2. Player performs actions in any order:
   - Deploy units from reserves (1 AP each)
   - Move units (1 AP each)
   - Attack with squares (1 AP per attacking square)
3. Player taps "End Turn" or runs out of AP
4. Handoff screen ("Pass to Player X")
5. Board rotates 180° for next player
6. Next player's turn begins
```

### Hot-Seat Handoff

Between turns, a full-screen interstitial shows "Pass device to [Player Name]" with a "Ready" button. This prevents the other player from seeing the board during handoff.

---

## Combat Resolution

### D40 Dice System

When units in a square attack an enemy square:

1. For each attacking unit, roll **1 d40 per remaining level** (HP).
2. Each roll **≤ threshold** = **1 hit**.
3. Base threshold: **6**.

### Bonuses (Additive to Threshold)

| Bonus | Condition | Modifier |
|-------|-----------|----------|
| Combined Arms 1 | 2 different unit types attacking together | +4 |
| Combined Arms 2 | All 3 unit types attacking together | +6 |
| Flanking 1 | Attacking from 2 different squares | +4 |
| Flanking 2 | Attacking from 3 different squares | +6 |
| Flanking 3 | Attacking from 4+ different squares | +8 |
| Cavalry Charge | Cavalry moved then attacked this turn | +6 |

- Bonuses are **additive**. A combined arms cavalry charge from 3 squares = +6 (CA) + +6 (flank) + +6 (charge) = threshold of **24**.
- Threshold is clamped: **minimum 2, maximum 38**.

### Coordinated Attacks

Multiple squares can attack the same enemy square in the same turn (each costs 1 AP). Flanking and combined arms bonuses are calculated across ALL participating squares.

### Damage Distribution (Like-Hits-Like)

When a square takes hits:
1. Infantry hits are assigned to enemy infantry first.
2. Cavalry hits are assigned to enemy cavalry first.
3. Artillery hits are assigned to enemy artillery first.
4. Remaining hits spill over to other unit types.
5. Each hit reduces the target unit's level by 1.
6. Units at level 0 are destroyed and removed.

---

## Victory Conditions

A player wins by any of:

1. **Elimination** — Destroy all enemy units (including reserves).
2. **Flag Capture** — Move any unit into the enemy's reserve zone.
3. **Forced Retreat** — Opponent retreats (voluntary).

### Retreat

- A player can tap "Retreat" during their turn.
- The opponent gets **one free attack** on all retreating units before they leave.
- Surviving units return to reserves with current HP.
- The retreating player loses the battle.

---

## Scope Exclusions (v1)

The following original-game mechanics are excluded from v1 for simplicity:

- Leader stats (charisma, reputation, attacks stat)
- Panic/morale (involuntary retreat)
- War Academy research (attack/defense modifiers)
- Garrison defense bonuses
- Variable army composition (draft/loadout)
- Online multiplayer

These can be added in future versions.

---

## Tech Stack

- **Rendering:** HTML5 Canvas
- **Language:** Vanilla TypeScript
- **Build:** None initially (dev server only)
- **Platform:** Mobile-first web app (portrait orientation)
- **Entry point:** Single `index.html`

---

## UI Design

### Screen Layout (Portrait Mobile)

```
┌──────────────────────────┐
│  P2: [AP: ●●●●●●] [6u]  │  Player 2 status bar
├──────────────────────────┤
│                          │
│   ┌─────┬─────┬─────┐   │
│   │ P2 RESERVES/FLAG│   │
│   ├─────┼─────┼─────┤   │
│   │     │     │     │R3 │
│   ├─────┼─────┼─────┤   │
│   │     │     │     │R2 │
│   ├─────┼─────┼─────┤   │
│   │     │     │     │R1 │
│   ├─────┼─────┼─────┤   │
│   │     │     │     │R0 │
│   ├─────┼─────┼─────┤   │
│   │ P1 RESERVES/FLAG│   │
│   └─────┴─────┴─────┘   │
│                          │
├──────────────────────────┤
│  P1: [AP: ●●●●○○] [4u]  │  Player 1 status bar
├──────────────────────────┤
│  [ END TURN ] [ RETREAT ]│  Action buttons
└──────────────────────────┘
```

### Interaction Flow

1. **Tap a square** → Select it. Shows units in the square. Highlights valid moves (green) and valid attacks (orange).
2. **Tap valid green square** → Move selected unit there (costs 1 AP).
3. **Tap valid orange square** → Attack that square with all units in selected square (costs 1 AP).
4. **Tap reserve zone** → Pick a unit to deploy to home row (costs 1 AP).
5. **Tap "End Turn"** → Ends turn, shows handoff screen.
6. **Tap "Retreat"** → Confirm dialog, then opponent gets free shot.

### Visual Language

- **Infantry:** Small filled square (■), colored blue (P1) or red (P2)
- **Cavalry:** Triangle (▲)
- **Artillery:** Circle (●)
- **Unit level:** Small number beside icon
- **Highlights:** Green = valid move, Orange = valid attack, Yellow = selected
- **Board rotation:** 180° flip between turns so active player is always at bottom

---

## Code Architecture

```
src/
  main.ts          — Entry point, game loop, ties modules together
  game-state.ts    — Pure data types: grid, units, players, turn state
  rules.ts         — Pure functions: valid moves, attacks, damage calc, bonuses
  combat.ts        — D40 dice rolling, hit resolution, damage distribution
  renderer.ts      — Canvas drawing (stateless, renders from game state)
  input.ts         — Touch/click handling, maps screen coords to game actions
  types.ts         — TypeScript type definitions
index.html         — Single entry point, loads canvas
```

**Principles:**
- All game logic as pure functions (easy to test)
- Renderer is stateless — just draws current game state
- Input module translates touches to game actions
- No classes, no inheritance — composition and plain objects
- Strict TypeScript throughout

---
applyTo: '**'
---
This repository contains **Photo Jumper**, a web-based platformer where players take a photo and the game generates a playable level using block-based platforms detected from image brightness, edges, and (optionally) ONNX-based ML object detection.

These instructions define the **non-negotiable design principles, gameplay rules, and technical constraints** that GitHub Copilot and AI coding agents must follow when suggesting or modifying code in this repository.

---

## ⚡ Latest Context — Check EJS Docs First

Before making decisions, check the **EJS (Engineering Journey System)** docs for the most up-to-date architecture decisions and session context:

1. **`ejs-docs/adr/`** — Latest ADRs with linked journey sessions (most current architectural decisions)
2. **`ejs-docs/journey/`** — Dated session logs showing what changed and why (sorted by date, check newest first)
3. **`ejs-docs/agent-memory/`** — Learned patterns, anti-patterns, and prompt patterns

These take precedence over `docs/adr/` when there is a conflict, as they represent the latest state.

---

## Core Principle (Highest Priority)

> **If image accuracy and gameplay quality conflict, gameplay quality wins.**

A technically accurate interpretation of a photo that results in unfair, unclear, or unwinnable gameplay is considered a failure.

---

## Core Gameplay Promise

> **If a platform looks jumpable, it must be jumpable.**

Players must be able to trust:
- Visuals
- Collision
- Physics
- Difficulty

---

## High-Level Goals

Copilot should prioritize:

1. Jump responsiveness and predictability
2. Clear and fair platform geometry
3. Fast iteration and tunable mechanics
4. Deterministic behavior (same input → same result)
5. Performance on low-power and mobile devices

---

## Photo → Platform Generation Rules

Detected image geometry must be treated as **input hints**, not ground truth.

### Grid-Based Detection (Primary — always available)

Grid-based brightness/edge sampling (see ADR 0003):

- Grid cells are sampled at `GRID_SIZE` (20px) intervals
- Brightness and edge-detection thresholds filter candidate cells
- Cells are merged into block-aligned platforms
- Short, noisy, or low-confidence regions are discarded

### ONNX ML Object Detection (Optional — opt-in)

ONNX Runtime Web with YOLOv8n model (see ADRs 0005, 0007):

- **Opt-in** toggle in the game UI; disabled by default on low-power devices
- Lazy-loaded from CDN (`onnxruntime-web@1.17.0`) — does not penalize initial page load
- Uses WASM backend for broad compatibility
- Detects objects from COCO dataset classes; filters by `PLATFORMABLE_CLASSES`
- Bottom-edge heuristic maps bounding boxes to platform surfaces
- Falls back to grid-based detection on any error, timeout, or user toggle-off
- ML-detected platforms are merged with grid-based platforms; duplicates are filtered
- All ML-generated platforms pass through the same gameplay constraints as grid platforms

Copilot must ensure:

- Platform generation respects gameplay constraints even if it alters photo fidelity
- ML detection remains optional and never required for playable levels
- Any new detection method must fall back gracefully to grid-based detection
- All platforms (regardless of source) pass reachability validation

---

## Block-Based Platform System

Platforms use a **modular block system** (see ADR 0009):

- `BLOCK_SIZE = 20` — all platforms snap to the 20px grid
- `PLATFORM_THICKNESS = BLOCK_SIZE` (1 block high)
- Minimum platform width: **2 blocks (40px)**
- Wall blocks are placed at platform edges (1 block tall) for visual clarity
- Platforms are rendered with individual block outlines for a pixel/block aesthetic
- Vertical clash filtering removes platforms that overlap or crowd vertically

### Helper Platform Strategy (5-Level Fallback)

When gaps exceed jump capability, helper platforms are inserted using a 5-step escalation:

1. Midpoint platform between two reachable platforms
2. Staircase of stepping-stone blocks
3. Extended landing shelf on the target platform
4. Bridge of small block platforms across the gap
5. Direct connector as a last resort

Helper platforms must always result in a reachable path.

---

## Jump & Reachability Constraints

Levels must always be winnable using current player physics.

### Variable-Height Jump

The game uses a **jump-cut mechanic**:
- **Tap/quick press** = short hop (velocity damped by `JUMP_CUT_DAMPING` on release)
- **Hold** = full-height jump (unchanged maximum)
- Maximum jump height is the physics invariant; minimum jump height is player-controlled
- The jump cut applies during the rising phase only (while `velocityY < 0`)

### Reachability Validation

- Multi-hop BFS validates that all letters and the goal are reachable from spawn
- Reachability is checked before gameplay begins
- If reachability fails, helper platforms are inserted or geometry is adjusted
- `MAX_GOAL_CANDIDATES = 3` — goal position is randomized among top reachable candidates

Copilot must:

- Respect maximum horizontal jump distance and vertical jump height
- Prevent accidental precision jumps
- Insert helper platforms or adjust geometry if gaps exceed limits
- Ensure start → goal reachability before gameplay begins
- Never modify jump physics values unless explicitly requested

---

## Letter Collection & Scoring

The game includes a **word-spelling challenge** (see ADR 0008):

- A random word is chosen from `WORD_DICTIONARY` at level start
- Golden letter collectibles are placed on reachable platforms (validated by BFS)
- Players collect letters by walking through them
- A word bar HUD shows progress (collected vs uncollected letters)
- Bonus points for completing the word; extra bonus for collecting in correct order
- Letters must not be placed on unreachable platforms

---

## Goal System

- A **golden portal** is placed on the goal platform
- The goal platform glows with a pulsing effect
- Walking into the portal wins the level
- Goal position is randomized among `MAX_GOAL_CANDIDATES` top reachable platforms

---

## Difficulty Normalization

Difficulty must be intentional and consistent.

Copilot should:
- Clamp extreme gaps or heights
- Prefer fewer, clearer platforms over many noisy ones
- Avoid stacking difficulty unintentionally
- Never allow difficulty spikes caused by photo noise

---

## Camera, Collision & Feedback

Copilot must ensure:

- What the player sees matches what they collide with
- No hidden hazards or ambiguous edges
- Stable collision at platform boundaries
- Predictable physics at all frame rates

### Camera & Zoom

- Camera follows the player with configurable smoothing
- Auto-fit zoom (`camera.autoFitZoom`) is computed to fit the world in the viewport
- Zoom controls: `+`/`-` keys, `0` resets to auto-fit, mouse wheel, on-screen ±/⊙ buttons
- Zoom range: `camera.minZoom` (computed) to `camera.maxZoom` (2.0)

### Stuck Detection

- 15-second inactivity timer (`STUCK_CHECK_INTERVAL`)
- If the player hasn't moved `STUCK_MOVEMENT_THRESHOLD` and is on the ground, auto-respawn triggers
- Timer resets on any input

Small feedback improvements (e.g. clearer landings) are preferred over complex systems.

---

## Controls

### Keyboard
- **Arrow keys / WASD** — movement
- **Space / Up / W** — jump (hold for full height, tap for short hop)
- **R** — respawn at start position
- **G** — regenerate level from same photo
- **+/-** — zoom in/out
- **0** — reset zoom to auto-fit

### Touch (Mobile)
- **◀ ▲ ▶ buttons** — left, jump, right (80% opacity, bumps to 100% on press)
- **Canvas swipe** — horizontal movement; tap to jump
- **On-screen R/G buttons** — respawn and regenerate (grouped with zoom controls)

### On-Screen Button Group (bottom-right, visible in fullscreen)
- **G** — regenerate level
- **R** — respawn
- *(visual separator)*
- **−** — zoom out
- **⊙** — reset zoom
- **+** — zoom in

---

## Transparency & Debugging

When useful, Copilot should prefer adding **optional debug tooling** over guessing.

Implemented debug features (toggled via checkbox in game UI):
- Debug overlay showing detected grid cells, platform bounds, and player collision box
- ML detection overlay showing ONNX-detected bounding boxes and confidence scores
- Visual distinction between grid-detected and ML-detected platforms

Debug features must not affect gameplay performance when disabled.

---

## Technical & Architectural Constraints

Copilot must:

- Keep image processing separate from gameplay logic
- Avoid blocking the main UI thread (prefer Web Workers where appropriate)
- Keep physics lightweight and deterministic
- Expose tunable values instead of hardcoding numbers
- Prefer clarity and readability over cleverness
- ONNX Runtime Web is lazy-loaded from CDN; never block page load on ML model
- Maintain single-file `index.html` philosophy (CDN imports are acceptable)
- All physics scale proportionally to world size via `BASE_WORLD_WIDTH` ratio

---

## Educational & AI-Friendly Code Expectations

This project is intended to be readable, explainable, and modifiable.

Copilot should:

- Use clear variable and function names
- Avoid magic numbers
- Comment non-obvious logic
- Propose solutions that a learner could understand and tweak

If proposing complexity, Copilot must also explain:

> *How would a learner reason about or modify this?*

---

## Recommended Config Values

These are the **actual values** used in the game. Copilot must reference these when suggesting physics, geometry, or detection code.

### Player Physics (Invariants — do not modify without explicit request)
- `PLAYER_SIZE = 20` — 20×20px hitbox (matches `BLOCK_SIZE`)
- `PLAYER_SPEED = 3` — horizontal movement speed
- `PLAYER_JUMP_POWER = 14` — initial upward velocity on jump
- `PLAYER_GRAVITY = 0.5` — downward acceleration per frame
- `JUMP_CUT_DAMPING = 0.5` — velocity multiplier on early jump release (variable jump)
- All physics scale with `worldWidth / BASE_WORLD_WIDTH` ratio

### Block & Platform Geometry
- `BLOCK_SIZE = 20` — fundamental grid/block unit
- `GRID_SIZE = 20` — detection grid cell size (matches block size)
- `PLATFORM_THICKNESS = BLOCK_SIZE` — platforms are 1 block thick
- Minimum platform width: **2 blocks (40px)**
- Wall blocks at platform edges: **1 block tall**

### Detection Thresholds
- `BRIGHTNESS_THRESHOLD = 140` — minimum brightness for grid-based platform detection
- `EDGE_DETECTION_THRESHOLD = 30` — edge gradient threshold
- `ML_CONFIDENCE_THRESHOLD = 0.3` — ONNX detection confidence filter
- `ML_INPUT_SIZE = 640` — YOLOv8n input dimensions
- `ML_INFERENCE_TIMEOUT_MS = 5000` — maximum ML inference time before fallback

### Level Safety Guardrails
- Multi-hop BFS reachability validation for all letters and goal
- 5-level helper platform fallback strategy
- `MAX_GOAL_CANDIDATES = 3` — goal randomization pool
- `STUCK_CHECK_INTERVAL = 15000` — 15s inactivity auto-respawn

### Camera & Viewport
- `camera.autoFitZoom` — computed to fit world in viewport
- `camera.maxZoom = 2.0`
- `camera.smoothing = 0.1`
- Canvas fills full viewport in fullscreen mode (`window.innerWidth × window.innerHeight`)

### Performance Targets
- Target frame rate: **60 fps**
- Max ML inference time: **5000ms** (falls back to grid-based on timeout)
- Max platform count: **50**

---

## Acceptance Mindset

A change is considered successful only if:

- The level remains winnable (BFS reachability passes)
- Platforms feel solid and fair
- Player deaths are explainable
- Visuals and collisions are aligned
- Letters are collectible and reachable
- Goal portal is reachable
- Variable jump feels responsive (tap = short hop, hold = full jump)
- Performance remains acceptable on modest devices

---

## Key ADRs

- **ADR 0003** — Grid-based platform detection density and mobile controls
- **ADR 0005** — ONNX-based object detection for platform generation
- **ADR 0007** — ONNX Runtime Web implementation and fixes
- **ADR 0008** — Letter collection, scoring, and reachability validation
- **ADR 0009** — Modular block platform system

---

## Related Workflow

- Use the AI-friendly issue template for fixes
- Treat issues as design briefs, not just bug reports
- Prefer small, testable improvements
- Avoid large refactors without justification

---

## Final Reminder

> **Gameplay feel, fairness, and player trust are more important than faithfully reproducing every detected line.**
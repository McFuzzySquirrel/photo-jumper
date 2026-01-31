---
applyTo: '**'
---
This repository contains **Photo Jumper**, a web-based platformer where players take a photo and the game generates a playable level by detecting straight lines and converting them into platforms.

These instructions define the **non-negotiable design principles, gameplay rules, and technical constraints** that GitHub Copilot and AI coding agents must follow when suggesting or modifying code in this repository.

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

**Current approach:** Grid-based brightness/edge sampling (see ADR 0003)  
**Future exploration:** ONNX Runtime Web for semantic object detection (see [Object Detection Research](../../learning/journey/research/object-detection.md))

Copilot must ensure:

- Lines are filtered, normalized, and merged before becoming platforms
- Short, noisy, or low-confidence lines are discarded
- Nearly collinear lines are merged into single platforms
- Near-horizontal lines are snapped to true horizontal within tolerance
- Platform generation respects gameplay constraints even if it alters photo fidelity
- Any ML-based detection (if implemented) must be optional and fall back to grid-based method
- ML-detected objects must still pass through all gameplay constraints (reachability, fairness, etc.)

---

## Platform Geometry Constraints

All generated platforms must obey:

- Minimum platform width (e.g. ~40px)
- Minimum platform thickness (e.g. ~12–16px)
- No paper-thin collision surfaces
- No invisible collision padding beyond visuals
- Visual edges must match collision edges exactly

If detected geometry violates these rules:
- Adjust it to be playable, **or**
- Discard it entirely

---

## Jump & Reachability Constraints

Levels must always be winnable using current player physics.

Copilot must:

- Respect maximum horizontal jump distance
- Respect maximum vertical jump height
- Prevent accidental precision jumps
- Insert helper platforms or adjust geometry if gaps exceed limits
- Ensure start → end reachability before gameplay begins

Jump physics values are **invariants** and must not be modified unless explicitly requested.

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

Small feedback improvements (e.g. clearer landings) are preferred over complex systems.

---

## Transparency & Debugging

When useful, Copilot should prefer adding **optional debug tooling** over guessing.

Recommended debug features:
- Raw detected lines overlay
- Final platform geometry overlay
- Visual distinction for discarded lines
- Clear explanation of why geometry was modified

Debug features must not affect gameplay performance when disabled.

---

## Technical & Architectural Constraints

Copilot must:

- Keep image processing separate from gameplay logic
- Avoid blocking the main UI thread (prefer Web Workers where appropriate)
- Keep physics lightweight and deterministic
- Expose tunable values instead of hardcoding numbers
- Prefer clarity and readability over cleverness
- If implementing ML-based object detection (ONNX), ensure it's lazy-loaded and optional
- Maintain single-file `index.html` philosophy where possible (CDN imports are acceptable)

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

These are **baseline values** for a multi-device web game. Copilot must reference these when suggesting geometry processing or physics code.

### Player Physics (Invariants)
- Max horizontal jump: **120px**
- Max vertical jump height: **90px**
- Player hitbox: **16px wide × 24px tall**
- Landing tolerance: **4px** vertical snap distance

### Platform Geometry Constraints
- Minimum width: **40px**
- Minimum thickness: **12px**
- Snap near-horizontal tolerance: **8°**
- Merge collinear tolerance: **6px**

### Level Safety Guardrails
- Maximum gap width: **140px** (≈ max jump distance + buffer)
- Maximum drop height: **100px** (must be reachable)
- Minimum platform spacing: **20px**
- Required clearance above player: **30px**

### Responsive Scaling
- Mobile (< 600px viewport): **0.8x scale**
- Tablet (600–1000px): **1.0x scale** (baseline)
- Desktop (> 1000px): **1.2x scale**

### Image Processing Thresholds
- Minimum line length: **30px**
- Confidence threshold: **0.6** (0–1)
- Noise filter blur: **3px radius**

### Performance Targets
- Target frame rate: **60 fps**
- Max line processing time: **100ms**
- Max platform count: **50**

---

## Acceptance Mindset

A change is considered successful only if:

- The level remains winnable
- Platforms feel solid and fair
- Player deaths are explainable
- Visuals and collisions are aligned
- Performance remains acceptable on modest devices

---

## Related Workflow

- Use the AI-friendly issue template for fixes
- Treat issues as design briefs, not just bug reports
- Prefer small, testable improvements
- Avoid large refactors without justification

---

## Final Reminder

> **Gameplay feel, fairness, and player trust are more important than faithfully reproducing every detected line.**
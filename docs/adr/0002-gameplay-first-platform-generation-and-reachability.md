# ADR 0002: Gameplay-first platform generation and reachability

- Status: Accepted
- Date: 2026-01-28

## Context

Photo Jumper generates platforms from a user-provided photo. The current generator is intentionally simple (grid sampling + brightness threshold + lightweight edge hint), but it can produce:

- Noisy “block fields” that create accidental precision gaps.
- Collisions that do not match what a player intuitively perceives as a “platform top”.
- Levels that are not reliably winnable (no guaranteed start → goal path).

This is a platformer: if a platform looks jumpable, it must be jumpable. When photo fidelity and gameplay quality conflict, gameplay quality wins.

Constraints:
- Keep the project low-friction (no build step; single-file game remains acceptable).
- Keep physics values invariant unless explicitly requested.
- Ensure collision surfaces match visuals exactly (no invisible padding).
- Keep performance acceptable on low-power/mobile devices.
- Prefer deterministic behavior (same input photo → same platforms).

## Decision

We will treat photo-derived geometry as *hints*, not ground truth, and enforce gameplay-first constraints by changing generation from “solid blocks” to “platform tops”:

1. **Generate a solid grid hint** from brightness threshold and edge detection (existing approach), excluding reserved start/goal regions.
2. **Extract only top-facing surfaces** (a platform exists where a solid cell has empty space above it).
3. **Normalize platform geometry**:
   - Snap to horizontal surfaces (top surfaces are horizontal by construction).
   - Merge adjacent collinear segments into longer platforms.
   - Discard short/noisy segments below a minimum width.
   - Enforce a minimum platform thickness.
4. **Guarantee reachability**:
   - Compute conservative jump limits from the existing physics.
   - Build a simple reachability graph from start platform to goal support.
   - If unreachable, insert deterministic helper platforms (clearly styled) to create a fair path.
5. **Add optional debug visibility**:
   - Provide an opt-in overlay showing the solid grid hint, final platforms, and helper platforms.
   - Debug rendering must be off by default and have near-zero overhead when disabled.

## Consequences

### Positive

- Gameplay becomes fairer and more predictable: fewer accidental precision jumps.
- “Platform tops” match player expectations and reduce side/ceiling collision noise.
- Levels become reliably winnable (start → goal is enforced).
- Debug overlays make tuning transparent and easier.

### Negative / trade-offs

- Generated platforms may diverge from the photo’s exact shapes (intentional).
- Helper platforms can reduce “purity” of photo-derived levels, but only appear when needed.

## Alternatives considered

- **Keep solid blocks, tune thresholds**: does not reliably solve noise/precision gaps.
- **Full line detection (e.g., Hough transform)**: potentially better fidelity but adds complexity and performance risk without guaranteeing playability.
- **Always place a fixed staircase**: guarantees reachability but ignores the photo too often.

## Implementation notes

- Primary implementation stays in `index.html` (no build pipeline).
- Introduce explicit, tunable constants:
  - Minimum platform width
  - Platform thickness
  - Conservative reachability margins
- Reachability is conservative by design: if the algorithm says “reachable”, it should be reachable in practice.


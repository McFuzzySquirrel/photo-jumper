# ADR 0003: Improve platform detection density and add mobile controls

- Status: Accepted
- Date: 2026-01-29

## Context

We received repeated mobile feedback that:

- The photo/platform detection produces too few usable platforms (“there should be more platforms” / “image detection should be improved”).
- Movement on mobile feels awkward because keyboard controls don’t exist on touch devices.

This conflicts with the core gameplay promise: **if a platform looks jumpable, it must be jumpable**, and players must be able to reliably control movement.

Constraints:
- Keep the project low-friction (single-file `index.html`, no build pipeline).
- Keep jump physics invariant unless explicitly requested (horizontal jump distance and jump height should not change).
- Prioritize gameplay quality and fairness over exact image fidelity.
- Keep mobile performance acceptable.

## Decision

We will improve playability via two targeted changes:

1. **Increase platform detection density (gameplay-first)** by tuning the existing grid-based photo sampling constants:
   - Reduce grid cell size to sample more densely.
   - Adjust brightness and edge thresholds to produce more candidate “solid” hints.
   - Keep downstream gameplay constraints (minimum platform width/thickness, reachability rules) as the guardrails that prevent noise from creating unfair levels.

2. **Add on-screen mobile controls** that map directly to the existing keyboard input model:
   - Show controls only on touch-capable devices.
   - Provide Left / Jump / Right buttons.
   - Use `touchstart`/`touchend` (plus `touchcancel`) to set the same internal key flags used by keyboard input.
   - Add `aria-label`s for accessibility.

Additionally, we slightly reduce horizontal “friction” decay to make movement feel more responsive, without changing jump power or gravity.

## Consequences

### Positive

- Players get more platforms from typical photos, increasing the chance of a fun, winnable level.
- Mobile users can reliably move and jump without needing a keyboard.
- Controls stay deterministic and consistent because touch input reuses the keyboard flags.
- Accessibility improves via `aria-label` on control buttons.

### Negative / trade-offs

- More aggressive detection can increase noise; gameplay constraints must continue to discard/merge/snap to avoid accidental precision jumps.
- On-screen controls add UI chrome; we mitigate by only showing them on touch devices.
- Movement feel changes slightly due to friction tuning; this must be monitored to ensure it does not create unintended difficulty spikes.

## Alternatives considered

- **Require an external gamepad/keyboard on mobile**: unacceptable UX friction.
- **Add a virtual joystick library**: adds dependency and complexity; not needed for simple left/right/jump.
- **Replace detection with full line detection (e.g., Hough transform)**: potentially higher fidelity, but higher complexity and still does not guarantee playability.
- **Only tune thresholds** without changing grid size: helps, but doesn’t address sparse sampling on high-resolution images.

## Implementation notes

- All changes are contained in `index.html`.
- Tuned detection constants include (names as implemented):
  - `GRID_SIZE`
  - `BRIGHTNESS_THRESHOLD`
  - `EDGE_DETECTION_THRESHOLD`
  - `EDGE_BRIGHTNESS_THRESHOLD`
- Mobile controls are rendered as a small button row and are wired into existing `keys[...]` and `touchJumping` state.
- `touchcancel` is handled to avoid “stuck button” behavior.


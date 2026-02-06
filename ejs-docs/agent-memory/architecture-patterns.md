# Architecture Patterns Learned

## Jump-Cut Variable Height Mechanic
### Context
When implementing variable-height jumps in a platformer (tap = short hop, hold = full jump).
### Implementation Notes
- Add a `JUMP_CUT_DAMPING` constant (0.5 is a good starting value)
- Set `jumpCutAllowed = true` when jump initiates
- On release (keyup/touchend/touchcancel): if rising (`velocityY < 0`) and `jumpCutAllowed`, multiply `velocityY` by damping factor
- Clear `jumpCutAllowed` at apex (`velocityY >= 0`) to prevent applying damping during fall
- Wire into ALL release handlers: keyboard keyup, jump button touchend, canvas touchend, touchcancel
### Risks
- Forgetting to clear the flag at apex allows damping during fall (wrong behavior)
- Missing a release handler means the mechanic silently fails for that input method
- Changing damping value affects gameplay feel — always playtest after adjustment

## Auto-Fit Zoom Computation
### Context
When the game world size varies (generated from photos of different dimensions) and you need the camera to show the full level.
### Implementation Notes
- Compute `autoFitZoom = Math.max(minZoom, Math.min(minZoomToFitWorld, maxZoom))`
- Where `minZoomToFitWorld = Math.min(canvas.width / worldWidth, canvas.height / worldHeight)`
- Set as initial zoom after `resizeCanvas()` and `updateZoomLimits()` run
- `0` key resets to `autoFitZoom`, not a hardcoded value
### Risks
- Must compute AFTER canvas dimensions are known (after resize)
- `minZoom` must be recalculated when world dimensions change

## Button Group Organization
### Context
When adding on-screen action buttons to a mobile-friendly game UI alongside existing controls.
### Implementation Notes
- Group related buttons in a single container (e.g., action buttons + zoom buttons)
- Use a visual separator (1px line, `rgba(255,255,255,0.3)`) between logical groups
- Distinct styling per group (e.g., blue gradient for action buttons, dark gradient for zoom)
- Base opacity 0.8 with `transition: opacity 0.1s`, bumps to 1.0 on `:active`
- Both `click` and `touchstart` (with `preventDefault`) handlers for cross-device support
### Risks
- Missing `preventDefault` on `touchstart` causes double-fire on mobile (click + touch)
- Opacity transitions need explicit `opacity` in the `transition` property

## Batch Multi-Replace Editing
### Context
When making many related changes across a single large file (e.g., CSS + HTML + JS sections of index.html).
### Implementation Notes
- Use `multi_replace_string_in_file` with all replacements in one call
- Include 3+ lines of context before and after each target for unique matching
- Order replacements logically (CSS → HTML → JS) for readability
- Run `get_errors` once after the batch to validate all changes
### Risks
- If any replacement fails to match, the entire batch may partially apply
- Long context strings are needed when the same pattern appears multiple times in the file

## Single-File Architecture with CDN Imports
### Context
Photo Jumper uses a single `index.html` with all CSS, HTML, and JS inline. External libraries (ONNX Runtime Web) are lazy-loaded from CDN.
### Implementation Notes
- Keep all game code in `index.html` — CSS in `<style>`, HTML in `<body>`, JS in `<script>`
- CDN imports are acceptable but must be lazy-loaded (never block page load)
- Use Web Workers for heavy computation (ML inference) to avoid blocking main thread
- All physics constants and config values in one block at top of script for discoverability
### Risks
- File grows large — use clear section comments and consistent structure
- Editing requires careful context matching due to file size

## Post-BFS Feature Placement
### Context
When a feature depends on knowing which platforms are reachable from which (e.g., wall blocks, decorations, enemy placement).
### Implementation Notes
- Place the feature in the pipeline AFTER `addHelperPlatformsIfNeeded()` but BEFORE coordinate scaling
- At that point, all platforms (grid, ML, helpers) are finalized and BFS has validated reachability
- Use `canReachPlatform(from, to, limits)` pairwise to build neighbor relationships
- Check both directions: `canReachPlatform(a, b)` and `canReachPlatform(b, a)` for bidirectional paths (jump-up and drop-down)
- Use process coordinates (not yet scaled to world coordinates)
### Risks
- Must run before scaling — process coordinates and world coordinates differ by `scaleX/scaleY`
- O(n²) pairwise check is fine with max 50 platforms but could matter if platform count grows
- `processWidth`/`processHeight` must be accessible in the function scope (closure inside `processImage`)

## Camera Centering for Viewport-Exceeds-World
### Context
When the viewport (canvas / zoom) is larger than the game world in one or both dimensions.
### Implementation Notes
- Branch the clamping logic: if `viewportWidth >= worldWidth`, use `camera.x = -(viewportWidth - worldWidth) / 2`
- Same for Y axis independently
- When viewport fits within world, use normal clamping: `Math.max(0, Math.min(camera.x, worldWidth - viewportWidth))`
- Negative camera values are valid — they mean the world starts offset from the canvas edge
### Risks
- Drawing outside world bounds now shows the letterbox color — must clear canvas with a dark color first
- Sky-blue fill must be drawn explicitly inside world bounds after the camera transform

## Dark Letterbox Framing
### Context
When the game world doesn't fill the entire viewport (different aspect ratios, zoomed out).
### Implementation Notes
- Clear entire canvas with dark color (`#1a1a2e`) — this becomes the letterbox
- After applying camera transform (`ctx.scale` + `ctx.translate`), fill `(0, 0, worldWidth, worldHeight)` with sky blue (`#87ceeb`)
- Draw the photo on top of the sky-blue fill
- Order: dark clear → camera transform → sky fill → photo → platforms → player
### Risks
- The sky-blue fill must use world coordinates (after camera transform), not screen coordinates
- If camera centering is off, the sky-blue rect won't align with the photo
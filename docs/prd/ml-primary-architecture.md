# PRD: ML-Primary Platform Generation

## Summary
Switch platform generation to an ML-primary pipeline using YOLOE-26n-seg (open-vocabulary + segmentation). Replace the current grid-first hybrid with a confidence-based fallback chain for ML-sparse photos. Preserve block-based rendering and gameplay-first constraints. Split the monolithic game file into ES modules without introducing a build step.

## Goals
- ML-first detection with consistent, playable platforms.
- Robust fallback for photos with few or zero ML detections.
- Keep the block aesthetic (stepped contours, 20px grid alignment).
- Keep PWA support and offline caching.
- Maintain deterministic, reachable levels with helper platform strategy.

## Non-Goals (Phase 1)
- Depth estimation models (deferred).
- Curved contour rendering (deferred).
- Build tooling migration (Vite) unless explicitly approved.

## Model Choice
- **YOLOE-26n-seg** exported to ONNX.
- Curated vocabulary (initially ~100–150 classes): COCO 80 + landscape/architecture additions.
- NMS-free end-to-end outputs; segmentation masks used for platform top contour.

## Detection Pipeline (Confidence-Based)
1. **ML detection (YOLOE)**
   - If ML platforms >= 8: finalize.
2. **Hough horizontal lines**
   - Add line-derived platforms if ML count is 3–7.
3. **Edge-density heat map**
   - Add edge-density platforms if ML count < 3.
4. **Feature-guided procedural skeleton**
   - Ensure a playable path from start to goal.

## Platform Placement
- Use segmentation masks to derive the top contour.
- Convert contours to stepped blocks (20px grid).
- For fallback to bounding boxes, apply per-class heuristics:
  - Vehicles/furniture/appliances: top edge.
  - People/animals: top 25% of box.

## Module Split (No Build Step)
- `index.html` → load ES modules via `<script type="module">`.
- Planned modules:
  - `js/config.js`
  - `js/engine/player.js`
  - `js/engine/platform.js`
  - `js/engine/letter.js`
  - `js/detection/ml.js`
  - `js/detection/fallback.js`
  - `js/level/generator.js`
  - `js/camera.js`
  - `js/game-loop.js`
  - `js/ui.js`
  - `js/controls.js`

## PWA & Caching
- Update `sw.js` precache list to include module files and the YOLOE ONNX model.
- Add a dedicated ML loading modal for model download and initialization.

## Acceptance Criteria
- Levels are always reachable (BFS validated) and playable.
- ML-first detection produces platforms for indoor/outdoor/architecture/nature photos.
- ML-sparse photos still yield playable levels without manual tuning.
- All platforms align to the 20px grid and follow block rendering.
- PWA remains installable and works offline after first load.

## Risks & Mitigations
- **Model size (≈20MB)**: use service worker caching and loading UI.
- **Low-end device performance**: keep WASM single-thread and optimize post-processing.
- **Sparse detections**: fallback chain guarantees minimum platform count.

## Milestones
1. Create module structure and migrate current code.
2. Integrate YOLOE model load/inference (ONNX).
3. Implement fallback chain and contour-to-block conversion.
4. Update service worker caching + UI loading state.
5. Validation pass: reachability, mobile performance, and UX.

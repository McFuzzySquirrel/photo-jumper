# Photo Jumper — Backlog

Items discovered during the full PRD build session (2026-03-30). Prioritized for future sessions.

---

## 🔴 Bugs

### ~~BUG-001: Infinite loop in helper platform insertion~~ ✅ RESOLVED
- **Fixed in**: `402b109` (2026-03-30)
- **Fix**: `addHelpers()` now returns actual placement boolean (`added > addedBefore`), MAX_ITERATIONS=50 hard cap, stall detection. 2 regression tests added.
- **Agent**: @gameplay-engineer

### BUG-002: Letter placement fails on low-platform levels
- **File**: `js/main.js` — `placeLettersOnPlatforms()`
- **Severity**: Medium
- **Found by**: Android emulator testing (2026-03-30)
- **Description**: When ML detection produces few platforms (≤7) and the goal gets relocated to the bottom, strict filtering (exclude start, goal, ceiling-blocked) leaves zero eligible platforms for letter placement.
- **Status**: ✅ RESOLVED in `81b634b` — 3-tier fallback: added 'start' kind, relaxed fallback includes goal, goal letters offset from portal.

### BUG-003: Native UI element overlap
- **File**: `css/android-game.css`
- **Severity**: Low
- **Found by**: Android emulator testing (2026-03-30)
- **Description**: Detection-mode-badge, pause button, and game-info HTML element overlapped in the top-right corner on native Android. Game-info was visible despite being canvas-drawn in native mode.
- **Status**: ✅ RESOLVED in `66a4b86` — Hidden debug/detection elements, forced game-info hidden, word-bar constrained.

---

## 🟡 QA Findings (Low Priority)

### FINDING-001: No keyboard shortcut to pause
- **Description**: Desktop keyboard users can only pause via mouse-clicking the pause button. ESC exits to intro. Consider adding `P` key for pause/resume toggle.
- **Agent**: @ui-controls-engineer

### FINDING-002: No pinch-to-zoom on mobile
- **Description**: Mobile zoom relies on +/−/reset buttons. No multi-touch zoom gesture. On native Android, zoom is hidden entirely (auto-fit). Appears intentional but could improve UX.
- **Agent**: @ui-controls-engineer

### FINDING-003: Game clock continues during pause
- **Description**: `pauseGame()` sets `gamePaused = true` but doesn't save `startTime`. Elapsed time includes paused duration. Not a bug per se (time is part of the challenge), but could be perceived as unfair.
- **Agent**: @gameplay-engineer

---

## 🟢 Future Enhancements

### ENHANCE-001: YOLOE-26n-seg model integration
- **Description**: Current segmentation uses YOLOv8n-seg as interim. When YOLOE-26n-seg is published to a CDN, update `SEG_MODEL_URLS` in `js/detection/ml.js` and verify output tensor format compatibility.
- **Agent**: @detection-engineer

### ENHANCE-002: Service worker cache for seg model
- **Description**: `models/yolov8n-seg.onnx` (SEG_MODEL_URLS) is not in SW `ML_ASSETS`. Once the model is available on disk or CDN, add it to the caching strategy in `sw.js`.
- **Agent**: @project-architect

### ENHANCE-003: Goal reachability before letter placement
- **Description**: When goal is relocated to a lower platform (unreachable from upper ML platforms), letters can't be placed on those upper platforms either. Consider running letter placement *after* goal relocation and helper insertion for better platform pool.
- **Agent**: @gameplay-engineer

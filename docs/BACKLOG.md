# Photo Jumper — Backlog

Items discovered during the full PRD build session (2026-03-30). Prioritized for future sessions.

---

## 🔴 Bugs

### BUG-001: Infinite loop in helper platform insertion
- **File**: `js/detection/helpers.js`
- **Severity**: High
- **Found by**: @qa-tester (Phase 4.2 automated tests)
- **Description**: `addHelpers()` returns `candidates.length > 0` instead of tracking whether any helper was *actually placed*. When strategies generate candidates but none pass `canReachPlatform`/`isWithinBounds` checks, `placed` is set to `true` but `failedAttempts` never increments — causing an infinite loop.
- **Trigger**: Platform gaps exceeding `maxJumpUp` (~196px) to the midpoint helper position.
- **Workaround**: Tests use moderate gaps and stub callbacks. In production, most photo-generated levels don't hit this because the skeleton fallback ensures traversable geometry.
- **Fix approach**: Track whether a helper was actually added (not just whether candidates were generated). Increment `failedAttempts` when no candidate passes placement checks. Add a hard iteration cap as safety net.
- **Agent**: @detection-engineer or @gameplay-engineer

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

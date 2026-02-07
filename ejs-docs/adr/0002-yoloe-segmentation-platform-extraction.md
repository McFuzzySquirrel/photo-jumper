# ADR 0002 — YOLOE Segmentation → Stepped Platform Extraction

## Status
Proposed

## Context
Photo Jumper is transitioning to an ML-primary pipeline with YOLOE-26n-seg. The model outputs segmentation masks that must be converted into stepped, block-aligned platforms. Gameplay quality is prioritized over photo fidelity.

## Decision
Implement a deterministic pipeline that:
1. Runs YOLOE segmentation.
2. Converts masks into top-contour bands.
3. Aligns contours to a 20px grid and generates stepped block platforms.
4. Clamps, merges, and validates reachability before gameplay.

## Pipeline Outline
1. **Inference**
   - Resize input to model size.
   - Run YOLOE-26n-seg in ONNX Runtime Web.
   - Apply confidence filtering and NMS on detections.
2. **Mask to contour**
   - Extract binary mask per detection.
   - For each mask, compute the highest solid pixel in each X column (top contour).
3. **Stepped platform conversion**
   - Snap contour points to 20px grid.
   - Group contiguous X segments into blocks (minimum width 2 blocks).
   - Generate 1-block-high platforms along contour.
4. **Gameplay safety**
   - Clamp platform counts to performance limits.
   - Merge platforms that align on the same Y band.
   - Run reachability BFS and helper insertion.

## Consequences
- Requires mask parsing utilities and grid snapping helpers.
- Ensures deterministic platform geometry aligned with gameplay constraints.
- Keeps image processing separate from gameplay logic.

## Notes
- This ADR does not change physics values.
- The fallback chain (Hough → edge-density → skeleton) remains active for sparse detections.

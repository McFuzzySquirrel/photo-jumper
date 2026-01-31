# ADR 0005: ONNX-based object detection for platform generation

- Status: Accepted
- Date: 2026-01-31

## Context

Current grid-based brightness/edge sampling (ADR 0003) produces platforms that don't always match the actual objects in the photo. Players expect platforms to appear where real objects are (tables, ledges, stairs, rocks), but the current approach only detects dark pixels without semantic understanding.

Key issues with grid-based detection:
- Platforms sometimes appear in empty space (shadows misdetected as surfaces)
- Actual objects may be missed if they don't meet brightness thresholds
- Photo fidelity suffers because detection doesn't "understand" what's in the image

Research was conducted (see `learning/journey/research/object-detection.md`) exploring various ML approaches including ONNX Runtime Web, TensorFlow.js, and enhanced edge detection.

Constraints:
- Maintain single-file `index.html` philosophy where possible (CDN imports acceptable)
- ML detection must be optional with fallback to current grid-based method
- Gameplay quality overrides image accuracy
- Jump physics must remain unchanged
- Platforms must be fair, predictable, and solid
- Keep mobile performance acceptable

## Decision

We will implement ONNX-based object detection as an **optional, experimental feature** that enhances platform generation by providing semantic understanding of photo content.

### Architecture

1. **Lazy-load ONNX Runtime Web from CDN** – Only load when user enables ML detection, avoiding impact on initial page load
2. **Use YOLOv8n (nano) model** – Small footprint (~6MB), good accuracy/performance balance
3. **Hybrid detection approach** – ML detection provides object hints, grid-based detection fills gaps
4. **Gameplay constraints remain paramount** – All detected platforms pass through existing reachability and fairness rules

### Implementation Details

1. **ONNX Runtime Loading**
   - Loaded from `cdn.jsdelivr.net/npm/onnxruntime-web`
   - Backends: WebGL → WASM fallback
   - Model loading with fallback chain:
     1. Local `models/yolov8n.onnx` (preferred for reliability)
     2. CDN fallback URLs
   - **Self-hosting recommended**: Place `yolov8n.onnx` in a `models/` folder next to `index.html`
   - Model can be downloaded from [Ultralytics releases](https://github.com/ultralytics/assets/releases)

2. **Object-to-Platform Mapping**
   - **Bottom edge heuristic**: Use the bottom edge of detected objects as platform surfaces
   - **Category filtering**: Prioritize "platformable" objects (tables, chairs, benches, laptops, etc.)
   - **Confidence threshold**: Filter detections below 0.5 confidence

3. **Platform Generation**
   - ML platforms are assigned distinctive colors (green for platformable objects, blue for others)
   - Grid-based platforms supplement ML platforms in areas without detected objects
   - All platforms pass through existing gameplay constraints (min width, reachability)

4. **User Controls**
   - Checkbox toggle: "ML object detection (experimental)"
   - Status indicator showing: loading, ready, object count, or errors
   - Debug overlay shows detected object bounding boxes with class labels

5. **Graceful Degradation**
   - If ONNX fails to load, feature is disabled with status message
   - If inference times out (5s), falls back to grid-based detection
   - Grid-based detection always runs as baseline

## Consequences

### Positive

- Platforms can now reflect actual objects in photos (tables, chairs, ledges)
- Semantic understanding reduces "phantom platforms" from shadows
- Users have more intuitive level generation from meaningful photos
- Feature is opt-in, so default experience is unchanged
- Debug overlay helps users understand what was detected

### Negative / trade-offs

- Model download adds ~6MB to lazy-loaded content when enabled
- Mobile inference can be slow on older devices (mitigated by timeout and fallback)
- Not all objects translate well to platforms (mitigated by category filtering)
- ML detection can miss objects (grid-based fallback compensates)
- Adds complexity to codebase (mitigated by keeping as separate, well-documented section)

## Alternatives Considered

- **TensorFlow.js (COCO-SSD)**: Similar capabilities, but ONNX is more flexible and framework-agnostic
- **Segmentation models (DeepLabV3)**: More accurate shapes but larger models and slower inference
- **Enhanced Canny/Sobel edge detection**: No model download but doesn't solve semantic understanding
- **Server-side inference**: Would require backend infrastructure, losing single-file simplicity

## Implementation Notes

- All changes contained in `index.html` (single-file philosophy maintained)
- ONNX functions are in a clearly marked section: `// ONNX ML Detection Functions`
- Tunable constants:
  - `ML_MODEL_URL`: CDN path to ONNX model
  - `ML_CONFIDENCE_THRESHOLD`: Minimum detection confidence (default: 0.5)
  - `ML_INPUT_SIZE`: Model input dimensions (640x640)
  - `ML_INFERENCE_TIMEOUT_MS`: Max inference time before fallback (5000ms)
  - `PLATFORMABLE_CLASSES`: Array of COCO classes suitable for platforms

### Performance Targets

- Model load: < 5s on broadband, acceptable with loading indicator
- Inference time: < 2s on mid-range mobile, < 500ms on desktop
- If inference exceeds timeout, graceful fallback to grid-based detection

### Debug Overlay

When debug overlay is enabled, detected objects are shown with:
- Green bounding boxes for "platformable" objects
- Orange bounding boxes for other detected objects
- Labels showing class name and confidence percentage

## References

- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/tutorials/web/)
- [YOLOv8 ONNX Export](https://docs.ultralytics.com/modes/export/)
- [COCO Dataset Classes](https://cocodataset.org/#explore)
- ADR 0002: Gameplay-first platform generation and reachability
- ADR 0003: Improve platform detection density
- Research: `learning/journey/research/object-detection.md`

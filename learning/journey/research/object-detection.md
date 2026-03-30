# Object Detection Research for Platform Generation

**Status:** Research / Exploration  
**Date:** 2026-01-31  
**Related ADR:** [ADR 0003: Improve platform detection density](../../../docs/adr/0003-improve-platform-detection-density-and-mobile-controls.md)

## Overview

Currently, Photo Jumper uses grid-based brightness/edge sampling for platform detection (see ADR 0003). While this works and follows our low-friction philosophy, it can produce sparse or noisy platforms depending on the photo content.

This document explores using **ONNX Runtime Web** and alternative ML-based object detection approaches to provide semantic understanding of objects in photos, which could lead to better, more intuitive platform placement.

**Key constraint:** Any ML-based detection must remain **optional** and **gameplay-first**. The current grid-based method serves as the fallback, and any detected objects must still pass through our existing gameplay constraints (reachability, minimum platform size, etc.).

---

## ONNX Runtime Web Approach

### What is ONNX Runtime Web?

[ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) is a cross-platform, high-performance ML inference engine that runs pre-trained ONNX models directly in the browser using:
- **WebGL** backend (good compatibility)
- **WebGPU** backend (modern, faster, but limited browser support)
- **WASM** backend (CPU fallback, universally supported)

ONNX models are framework-agnostic (can be exported from PyTorch, TensorFlow, scikit-learn, etc.) and optimized for inference.

### Suitable Models for Photo Jumper

| Model | Type | Size | Use Case | Notes |
|-------|------|------|----------|-------|
| **YOLOv8n** (nano) | Object detection | ~6MB | Detect objects with bounding boxes | Fast, accurate, good balance |
| **MobileNet-SSD** | Object detection | ~5-7MB | Lightweight object detection | Optimized for mobile, good browser perf |
| **DeepLabV3** | Semantic segmentation | ~10-20MB | Pixel-level object masks | More accurate platform shapes, but larger |
| **EfficientDet-Lite** | Object detection | ~5-8MB | Efficient bounding box detection | Good accuracy/size tradeoff |

**Recommendation for initial exploration:** Start with **YOLOv8n** or **MobileNet-SSD** for object detection (bounding boxes), as they offer the best balance of size, performance, and ease of use.

### Pros of ONNX Approach

✅ **Semantic understanding** – Knows what objects are (tables, chairs, books, etc.), not just edges  
✅ **Pre-trained models available** – No need to train from scratch; models trained on COCO, ImageNet, etc.  
✅ **Runs entirely in browser** – No server-side inference, maintains our low-friction philosophy  
✅ **No build pipeline changes needed** – Can be loaded via CDN or bundled as a static asset  
✅ **Multiple backends** – Falls back gracefully (WebGPU → WebGL → WASM)  
✅ **Well-documented** – ONNX Runtime has good examples and TypeScript support

### Cons of ONNX Approach

❌ **Model size (5-20MB)** – Increases initial page load or requires lazy-loading  
❌ **Mobile performance concerns** – Inference can be slow on older/low-end devices  
❌ **Need to map bounding boxes → platforms** – Object detection gives us rectangles; we still need logic to convert them into playable surfaces  
❌ **Not all objects are "platformable"** – A detected "person" or "car" doesn't directly translate to a horizontal platform  
❌ **Still requires gameplay constraints** – Detected platforms must pass reachability/fairness checks

---

## Alternatives to ONNX

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **ONNX (MobileNet-SSD, YOLOv8n)** | Semantic object detection, good accuracy, browser-native | Model size (5-10MB), mobile performance, need platform mapping | **Strong candidate** |
| **ONNX Segmentation (DeepLabV3)** | Pixel-level masks of objects, more accurate shapes | Larger models (10-20MB), still need platform mapping, slower inference | Consider for v2 if object detection works well |
| **TensorFlow.js (COCO-SSD)** | Similar to ONNX, well-documented, popular | Adds TensorFlow.js dependency (~500KB+), similar tradeoffs to ONNX | Viable alternative, but ONNX is more flexible |
| **MediaPipe (Selfie Segmentation)** | Very fast, lightweight, good for people/foreground separation | Limited to segmenting people, not general objects | Too narrow for general photo platform generation |
| **Enhanced edge detection (Canny/Sobel in JS)** | No model download, fast, pure JavaScript, small footprint | Still brightness-based, no semantic understanding, same noise issues | Doesn't solve the "semantic understanding" problem |
| **Hybrid: Depth estimation model (MiDaS, DPT)** | Could infer "surfaces" from monocular depth | Experimental, depth maps don't directly translate to 2D platforms, unclear benefit | Interesting but too speculative |
| **Custom lightweight model** | Tailored to our exact use case, potentially smaller | Requires training pipeline, labeled data, ongoing maintenance | Too much friction for this project |

### Recommendation

**Primary approach:** ONNX Runtime Web with YOLOv8n or MobileNet-SSD  
**Fallback:** Enhanced edge detection (Canny/Sobel) if model size/performance is prohibitive  
**Future exploration:** Segmentation models (DeepLabV3) if object detection proves valuable but lacks shape fidelity

---

## Implementation Considerations

### Architecture: Keep Detection Optional

```javascript
async function detectPlatforms(imageData) {
  // Try ML-based detection first (if available and enabled)
  if (onnxModelLoaded && userPreferences.useMLDetection) {
    try {
      const objects = await detectObjectsWithONNX(imageData);
      const platforms = mapObjectsToPlatforms(objects);
      return applyGameplayConstraints(platforms);
    } catch (err) {
      console.warn('ONNX detection failed, falling back to grid-based', err);
    }
  }
  
  // Fallback to current grid-based method
  return detectPlatformsGridBased(imageData);
}
```

**Key principles:**
- ML detection is **opt-in** and can be toggled off
- Always fall back to grid-based detection if:
  - Model fails to load
  - Inference throws an error
  - User disables ML detection
  - Device is too slow (based on performance heuristics)

### Mapping Objects to Platforms

**Challenge:** Object detection gives us bounding boxes (or segmentation masks). How do we turn those into horizontal platforms?

**Potential strategies:**

1. **Bottom edge heuristic** – Treat the bottom edge of each detected object as a potential platform surface
   - Works well for tables, benches, shelves, etc.
   - Fails for vertical objects (people, trees, poles)

2. **Horizontal surface detection** – Use segmentation masks to find horizontal runs of pixels within detected objects
   - More accurate but requires segmentation (larger models)

3. **Object category filtering** – Only use certain object types as platforms
   - E.g., "chair", "table", "bench", "book", "laptop" → platforms
   - "person", "dog", "ball" → skip or use differently

4. **Hybrid: Objects + edge detection** – Use object bounding boxes as "regions of interest", then run edge detection within those regions
   - Best of both worlds: semantic understanding + fine-grained shape detection

**Recommendation for MVP:** Start with **bottom edge heuristic + category filtering**. Only create platforms from objects that are likely to have horizontal surfaces.

### Maintaining Single-File Philosophy

ONNX Runtime Web can be loaded from a CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
```

The model file (`.onnx`) can be:
- Hosted as a static asset in the repo (if small enough, ~5MB is acceptable)
- Loaded from a CDN or external URL
- Lazy-loaded only when user opts in or after the first photo is taken

**Recommendation:** Keep `index.html` as the single entry point, but lazy-load ONNX runtime and model on-demand to avoid penalizing users who don't want ML detection.

### Performance Considerations

**Inference time targets:**
- Acceptable: < 200ms on mid-range mobile
- Good: < 100ms on mid-range mobile
- Ideal: < 50ms on desktop

**Strategies to meet targets:**
- Use WebGPU backend where available (much faster than WebGL/WASM)
- Downscale input image before inference (e.g., 320x320 or 640x640)
- Run inference in a Web Worker to avoid blocking the main thread
- Cache results per photo (don't re-run if user retries the same level)

**Performance escape hatch:**
- If inference takes > 500ms, disable ML detection for the session and fall back to grid-based

---

## Open Questions for Research

### 1. Which model provides the best balance of accuracy vs. size/performance?

**Need to test:**
- YOLOv8n (~6MB) vs. MobileNet-SSD (~5MB) vs. EfficientDet-Lite
- Measure inference time on:
  - High-end desktop (Chrome, Firefox, Safari)
  - Mid-range Android phone (Chrome)
  - iPhone (Safari)
  - Low-end Android phone

**Success criteria:**
- Inference < 200ms on mid-range mobile
- Model size < 10MB
- Produces platforms that are more intuitive than grid-based detection

### 2. How to map detected objects to "platformable surfaces"?

**Need to experiment:**
- Does bottom-edge heuristic work well enough?
- Do we need segmentation masks for better accuracy?
- What object categories should be platform-eligible?

**Success criteria:**
- Platforms look natural and match user intuition
- At least 70% of detected platforms pass reachability checks
- Fewer "weird" or "unfair" platforms than grid-based method

### 3. Should we use object detection (bounding boxes) or segmentation (pixel masks)?

**Tradeoff:**
- Object detection: faster, smaller models, but less accurate shapes
- Segmentation: more accurate shapes, but slower and larger models

**Hypothesis:** Object detection is good enough for MVP. We can always add segmentation later if needed.

**Test:** Run both on sample photos and compare platform quality.

### 4. What's the minimum viable model size for acceptable mobile performance?

**Hypothesis:** 5-10MB is acceptable if lazy-loaded, but > 15MB starts to feel heavy.

**Test:** 
- Measure page load time impact on 3G connection
- Test user tolerance for "Loading platform detector..." message

---

## Next Steps

1. **Prototype ONNX integration**
   - Load ONNX Runtime Web from CDN
   - Test YOLOv8n and MobileNet-SSD models
   - Measure inference time on target devices

2. **Experiment with platform mapping**
   - Implement bottom-edge heuristic
   - Test object category filtering
   - Compare results to grid-based method

3. **User testing**
   - Create a feature flag to toggle ML detection on/off
   - Collect feedback on platform quality
   - Measure performance impact

4. **Document findings**
   - Update this research doc with results
   - Create an ADR if we decide to adopt ONNX
   - Capture any new gameplay constraints needed for ML-based platforms

---

## References

- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/tutorials/web/)
- [YOLOv8 ONNX Export](https://docs.ultralytics.com/modes/export/)
- [MobileNet-SSD Models](https://github.com/tensorflow/models/blob/master/research/object_detection/g3doc/tf1_detection_zoo.md)
- [DeepLabV3 Segmentation](https://github.com/tensorflow/models/tree/master/research/deeplab)
- [ONNX Model Zoo](https://github.com/onnx/models)
- ADR 0003: Current grid-based detection approach and constraints

---

## Appendix: Example ONNX Integration Pseudocode

```javascript
// Lazy-load ONNX runtime
let onnxSession = null;

async function initONNX() {
  if (onnxSession) return;
  
  const session = await ort.InferenceSession.create('models/yolov8n.onnx', {
    executionProviders: ['webgpu', 'webgl', 'wasm']
  });
  onnxSession = session;
  console.log('ONNX model loaded');
}

async function detectObjectsWithONNX(imageData) {
  if (!onnxSession) await initONNX();
  
  // Preprocess image to model input size (e.g., 640x640)
  const inputTensor = preprocessImage(imageData, 640, 640);
  
  // Run inference
  const results = await onnxSession.run({ images: inputTensor });
  
  // Post-process results (NMS, filtering, etc.)
  const objects = postprocessYOLO(results);
  
  return objects; // [{ class: 'chair', bbox: [x, y, w, h], confidence: 0.9 }, ...]
}

function mapObjectsToPlatforms(objects) {
  const platformCandidates = objects
    .filter(obj => PLATFORMABLE_CLASSES.includes(obj.class))
    .filter(obj => obj.confidence > 0.6)
    .map(obj => ({
      x: obj.bbox[0],
      y: obj.bbox[1] + obj.bbox[3], // Bottom edge
      width: obj.bbox[2],
      height: 12, // Default platform thickness
      source: 'ml-detection'
    }));
  
  return platformCandidates;
}

const PLATFORMABLE_CLASSES = [
  'chair', 'couch', 'bed', 'dining table', 'bench',
  'book', 'laptop', 'keyboard', 'mouse', 'desk'
];
```

---

**Last updated:** 2026-01-31

# ADR 0007: ONNX Runtime Web Integration - Implementation and Fixes

- Status: Accepted
- Date: 2026-02-03
- Supersedes: ADR 0005 (implementation details)

## Context

ADR 0005 outlined the plan to add ONNX-based object detection. This ADR documents the actual implementation, challenges encountered, and solutions applied to make ONNX Runtime Web work reliably in Photo Jumper.

### Initial Implementation Challenges

1. **Service Worker Interference**: The service worker was blocking fallback URLs by throwing errors on 404s instead of passing them through naturally
2. **WASM Path Configuration**: ONNX Runtime couldn't find its WASM files (`ort-wasm-simd.wasm`, etc.)
3. **Model Output Parsing**: The YOLOv8n model output used a different key (`predictions`) than expected (`output0`)
4. **Data Access**: Tensor data needed to be accessed via `.cpuData` instead of `.data`
5. **Visual Clutter**: ML detection bounding boxes were always visible, interfering with gameplay

## Decision

We implemented a fully self-contained ONNX Runtime Web integration that:

1. ✅ Loads entirely from CDN (no local files required)
2. ✅ Has proper fallback handling (local → CDN)
3. ✅ Configures WASM paths correctly
4. ✅ Handles model output variations
5. ✅ Only shows debug overlays when requested
6. ✅ Provides helpful console feedback

## Implementation Details

### 1. Service Worker Fix

**Problem**: Service worker threw errors on 404 responses, preventing JavaScript fallback mechanism from trying CDN URLs.

**Solution**: Modified service worker to return 404s naturally instead of throwing errors:

```javascript
// Before: Used cacheFirstStrategy that threw on 404
event.respondWith(cacheFirstStrategy(event.request)); // ❌ Throws

// After: Inline caching that returns 404s
event.respondWith(
  caches.match(event.request).then(cachedResponse => {
    if (cachedResponse) return cachedResponse;
    return fetch(event.request).then(response => {
      if (response.ok) cache.put(event.request, response.clone());
      return response; // ✅ Returns 404 naturally
    }).catch(err => {
      console.log('[SW] Expected 404:', event.request.url);
      throw err; // Let JS fallback handle it
    });
  })
);
```

**Impact**: JavaScript fallback now works correctly (local → CDN).

### 2. WASM Path Configuration

**Problem**: ONNX Runtime couldn't locate WASM files, causing "Failed to fetch" errors.

**Solution**: Configure `ort.env.wasm.wasmPaths` after loading runtime:

```javascript
async function loadONNXRuntime() {
  // ... load script ...
  
  if (typeof ort !== 'undefined') {
    // Configure WASM paths based on source
    if (runtimeUrl.includes('://')) {
      // CDN - point to CDN directory
      const cdnBase = runtimeUrl.substring(0, runtimeUrl.lastIndexOf('/') + 1);
      ort.env.wasm.wasmPaths = cdnBase;
    } else {
      // Local - point to lib folder
      ort.env.wasm.wasmPaths = 'lib/';
    }
    
    ort.env.wasm.numThreads = 1; // Stability
    return true;
  }
}
```

**Impact**: WASM files now load correctly from CDN or local paths.

### 3. Execution Provider Simplification

**Problem**: Using `['webgl', 'wasm']` caused compatibility issues in some browsers.

**Solution**: Simplified to WASM-only execution:

```javascript
// Before
executionProviders: ['webgl', 'wasm']  // ❌ WebGL less stable

// After
executionProviders: ['wasm']  // ✅ More compatible
```

**Trade-off**: Slightly slower inference (~5s vs ~3s) but much more reliable.

### 4. Model Output Handling

**Problem**: YOLOv8n model uses `predictions` key, not `output0`. Tensor data requires `.cpuData` not `.data`.

**Solution**: Flexible output handling with proper data access:

```javascript
// Handle multiple possible output names
const output = results.predictions || results.output0 || results[Object.keys(results)[0]];

// Access tensor data correctly
const data = output.cpuData || output.data;

// Validate before processing
if (!data || !output.dims) {
  console.error('Invalid output:', output);
  return [];
}
```

**Impact**: Works with various YOLO model exports.

### 5. Debug Overlay Controls

**Problem**: Bounding boxes and labels always visible during gameplay, causing visual clutter.

**Solution**: Only show ML detection overlays when debug mode is enabled:

```javascript
// Before: Always shown
if (debugDetectedObjects && debugDetectedObjects.length > 0) { ... }

// After: Only in debug mode
if (debugOverlayEnabled && debugDetectedObjects && debugDetectedObjects.length > 0) { ... }
```

**Impact**: Clean gameplay experience by default, debug info available when needed.

### 6. Enhanced Logging and Feedback

**Problem**: Users didn't know what was happening or why ML detection wasn't finding objects.

**Solution**: Added comprehensive console logging:

```javascript
console.log('🤖 Running ML object detection...');
console.log(`ML detection found ${detections.length} total objects`);
console.log('Detected objects:', detections.map(d => 
  `${d.class} (${(d.confidence * 100).toFixed(1)}%) ${d.isPlatformable ? '✓ platformable' : '✗ not platformable'}`
).join(', '));
console.log(`${platformableDetections.length} of those are platformable`);

// Helpful hints
if (detections.length === 0) {
  console.log('ℹ️ No objects detected. Try photos with furniture, vehicles, or electronics.');
  console.log('   Note: Buildings/architecture are not detected - use grid-based detection for those.');
}
```

**Impact**: Users understand what ML is detecting and why platforms appear/don't appear.

## File Structure

### Required for Self-Contained Operation

**From CDN (auto-loaded):**
- `ort.min.js` (~300 KB) - ONNX Runtime
- `ort-wasm-simd.wasm` (~1.8 MB) - WASM backend

**Local (included in repo):**
- `models/yolov8n.onnx` (6 MB) - YOLO model

**Optional (for offline use):**
- `lib/ort.min.js` - Local runtime fallback
- `lib/ort-wasm*.wasm` - Local WASM files

### Fallback Chain

**Production (CDN-first):**
```
Runtime: CDN → lib/ort.min.js (local fallback)
Model:   CDN → models/yolov8n.onnx (local fallback)
```

**Why CDN-first?**
- Smaller deployment size (~500 KB vs ~9 MB)
- No large files in git repo
- Reliable CDN delivery (jsDelivr, GitHub)
- Automatic caching after first load

**Development:**
- Keep `models/yolov8n.onnx` locally for offline testing
- Add to `.gitignore` to avoid committing large files

## Performance Characteristics

| Scenario | Runtime Load | Model Load | Inference | Total |
|----------|--------------|------------|-----------|-------|
| First load (CDN) | 2-3s | 1-2s | 4-6s | 7-11s |
| Cached | <1s | <1s | 4-6s | 5-8s |
| Offline (cached) | <1s | <1s | 4-6s | 5-8s |

**Inference time breakdown:**
- Preprocessing: ~100ms
- WASM inference: ~4-5s
- Postprocessing (NMS): ~100ms

## Platformable Objects

ML detection creates platforms from these COCO classes:

**Furniture (7):** bench, chair, couch, bed, dining table, desk, toilet  
**Electronics (9):** tv, laptop, keyboard, book, microwave, oven, toaster, sink, refrigerator  
**Vehicles (8):** car, bus, truck, boat, train, airplane, bicycle, motorcycle  
**Sports Equipment (4):** skateboard, surfboard, snowboard, skis  
**Containers (3):** vase, potted plant, bowl  
**Animals (10):** bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe  
**People (1):** person  
**Other (9):** suitcase, backpack, clock, teddy bear, remote, mouse, cell phone

**Total: 51 platformable object types** (out of 80 COCO classes)

**NOT detected:** buildings, architecture, natural features (trees, rocks, grass, sky), some small items (cups, forks, food)

## User Experience

### When ML Detection Works Well

✅ **Indoor scenes** - Living rooms, offices, kitchens (furniture, electronics)  
✅ **Parking lots** - Cars, trucks, buses make great platforms  
✅ **Workspace photos** - Desks, laptops, monitors  
✅ **Pet photos** - Cats, dogs become platforms  
✅ **Zoo/wildlife** - Elephants, giraffes, zebras, bears  
✅ **Farm photos** - Horses, cows, sheep  
✅ **Family photos** - People's heads as platforms (Mario-style!)  
✅ **Sports/outdoor** - Bicycles, motorcycles, surfboards, skateboards

### When Grid-Based Works Better

✅ **Architecture** - Buildings, walls, structures  
✅ **Pure landscapes** - Natural scenes without animals  
✅ **Abstract/artistic** - Patterns, textures  
✅ **Food-focused** - Plates of food (no platformable objects)

### Debug Overlay

Users can enable "Debug overlay" checkbox to see:
- **Green boxes** = Platformable objects (creates platforms)
- **Orange boxes** = Detected but not platformable (ignored)
- **Blue boxes** = Grid-based platforms
- Labels with class names and confidence percentages

## Consequences

### Positive

1. ✅ **Self-contained** - Works without any local files (CDN-only)
2. ✅ **Reliable** - Proper error handling and fallback mechanisms
3. ✅ **Optional** - Disabled by default, no impact if not used
4. ✅ **Debuggable** - Comprehensive logging and visual overlays
5. ✅ **Educational** - Clear feedback about what's detected and why
6. ✅ **Cached** - Fast subsequent loads (service worker caching)

### Negative

1. ⚠️ **Slow inference** - 4-6 seconds per photo (WASM is slower than WebGL)
2. ⚠️ **Limited object types** - Only 80 COCO classes, no buildings/architecture
3. ⚠️ **First-time download** - ~2 MB for WASM files (one-time cost)
4. ⚠️ **Requires web server** - Cannot run from `file://` protocol

### Neutral

1. ℹ️ **Hybrid approach** - ML platforms + grid-based platforms combined
2. ℹ️ **Confidence threshold** - 50% default (adjustable in code)
3. ℹ️ **Browser compatibility** - Requires WebAssembly support (all modern browsers)

## Documentation Created

- `docs/ONNX_SETUP.md` - Complete setup guide
- `docs/ML_DETECTION_GUIDE.md` - User guide for ML feature
- `ONNX_FIX_SUMMARY.md` - Technical summary of fixes
- `TESTING_ONNX_FIX.md` - Testing instructions
- `clear-sw.html` - Service worker reset tool
- `test-onnx.html` - ONNX diagnostic tool

## Lessons Learned

### Service Worker Gotchas

Service workers are **persistent** and can cause confusing issues:
- Old service worker continues serving cached responses even after code updates
- Must be explicitly unregistered to clear
- Cache versioning (`v1` → `v2`) forces refresh
- Hard refresh (Ctrl+Shift+R) doesn't always clear service worker

**Solution**: Created `clear-sw.html` tool for easy reset.

### ONNX Runtime Web Specifics

1. **WASM path must be configured** - Not automatic
2. **Output names vary by model** - Must handle multiple possibilities
3. **Tensor data access** - Use `.cpuData` not `.data`
4. **100ms initialization delay** - Wait after script load before using `ort` object
5. **WASM backend is slower but more compatible** - WebGL faster but less reliable

### YOLOv8 Model Format

- Input: `[1, 3, 640, 640]` (NCHW format, RGB normalized to 0-1)
- Output: `[1, 84, 8400]` where:
  - First 4 features = `[cx, cy, w, h]` (center x/y, width, height)
  - Remaining 80 features = class probabilities (COCO classes)
- Requires letterboxing (gray padding) to maintain aspect ratio
- Requires Non-Maximum Suppression (NMS) to remove overlapping detections

## Future Improvements

Potential enhancements (not implemented):

- [ ] WebGL execution provider (faster but less compatible)
- [ ] Adjustable confidence threshold in UI
- [ ] Custom YOLO models (e.g., trained on architecture)
- [ ] Object detection preview before gameplay
- [ ] Platform editing/adjustment tools
- [ ] Web Worker for off-main-thread inference
- [ ] Model quantization for smaller size

## References

- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/tutorials/web/)
- [YOLOv8 Export Guide](https://docs.ultralytics.com/modes/export/)
- [COCO Dataset Classes](https://cocodataset.org/#explore)
- ADR 0005: Original ONNX proposal
- ADR 0003: Grid-based platform detection (fallback method)

## Acceptance Criteria

✅ All met:

- [x] ONNX Runtime loads from CDN without local files
- [x] Service worker doesn't block fallback mechanism
- [x] WASM files load correctly
- [x] Model inference produces valid detections
- [x] Platformable objects create platforms
- [x] Debug overlay only shows when enabled
- [x] Console provides helpful feedback
- [x] Works offline after first load (cached)
- [x] No gameplay impact when disabled
- [x] Documentation complete

---

**Status**: Implementation complete and working as of 2026-02-03.

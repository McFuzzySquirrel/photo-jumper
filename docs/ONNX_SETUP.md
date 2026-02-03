# ONNX ML Detection Setup Guide

This guide explains how to enable and troubleshoot ML-based object detection in Photo Jumper.

## Overview

Photo Jumper can optionally use machine learning (YOLO v8) to detect objects in photos and create platforms from them. This feature is:
- **Optional** - The game works perfectly fine without it
- **Experimental** - Uses ONNX Runtime Web for browser-based ML
- **Self-contained** - All dependencies can load from CDN (no local files required)

## Quick Start

### Option 1: CDN Only (Easiest - No Downloads Required)

1. Run the app via a web server:
   ```bash
   npm start
   ```
   
2. Open http://localhost:8080 in your browser

3. Upload a photo and check the "ML object detection (experimental)" checkbox

4. The app will automatically:
   - Load ONNX Runtime from CDN
   - Load the YOLOv8n model from CDN
   - Start detecting objects

**That's it!** No files to download. Everything loads from CDN on-demand.

### Option 2: Fully Self-Hosted (For Offline Use)

If you want to use ML detection offline or avoid CDN dependencies:

1. **Download ONNX Runtime Web files:**
   - Go to: https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/
   - Download these files:
     - `ort.min.js`
     - `ort-wasm.wasm`
     - `ort-wasm-simd.wasm`
     - `ort-wasm-threaded.wasm` (optional)
     - `ort-wasm-simd-threaded.wasm` (optional)
   
2. **Create a `lib/` folder** in the project root

3. **Place all downloaded files** in the `lib/` folder:
   ```
   photo-jumper/
   ├── lib/
   │   ├── ort.min.js
   │   ├── ort-wasm.wasm
   │   ├── ort-wasm-simd.wasm
   │   └── ... (other WASM files)
   ├── models/
   │   └── yolov8n.onnx (already included)
   └── index.html
   ```

4. The app will now prioritize local files over CDN

## Troubleshooting

### "Failed to load ML detection" Error

**Cause:** The app couldn't load ONNX Runtime or the model.

**Solutions:**

1. **Check you're using a web server** (not `file://` protocol):
   - ✅ Correct: `http://localhost:8080/index.html`
   - ❌ Wrong: `file:///C:/Users/.../index.html`
   - Run `npm start` to start the server

2. **Check browser console** for specific errors:
   - Press F12 → Console tab
   - Look for red error messages
   - Common issues:
     - CORS errors → Use `npm start` server
     - 404 errors → Model or runtime files missing
     - WASM errors → Browser doesn't support WASM

3. **Try different browsers:**
   - Chrome/Edge (recommended)
   - Firefox
   - Safari (may have limited WASM support)

4. **Clear cache and reload:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Clear site data in browser settings

5. **Check network connectivity:**
   - ML detection needs internet to load from CDN (unless self-hosted)
   - Check if CDN is accessible: https://cdn.jsdelivr.net/

### Model Loads but Detection Doesn't Work

1. **Check object types in photo:**
   - ML only detects specific objects (furniture, vehicles, electronics)
   - See `PLATFORMABLE_CLASSES` in code for full list
   - Natural scenes (trees, grass) won't create platforms

2. **Check confidence threshold:**
   - Set lower threshold in code: `ML_CONFIDENCE_THRESHOLD = 0.3`
   - Default is 0.5 (50% confidence required)

3. **Enable debug overlay:**
   - Check "Debug overlay" checkbox
   - Red boxes = detected objects
   - Blue boxes = generated platforms

### Performance Issues

1. **ML detection is slow:**
   - This is normal - ML inference takes 2-5 seconds
   - Status indicator shows progress
   - Wait for "ML ready" before playing

2. **Game stutters during detection:**
   - ML runs in background
   - Should not affect gameplay once loaded
   - Try reducing photo resolution

## Technical Details

### Dependencies

- **ONNX Runtime Web:** 1.17.0
  - JavaScript ML inference engine
  - Runs in WebAssembly for performance
  - ~2MB download (runtime + WASM)

- **YOLOv8n Model:** 
  - Nano version (smallest YOLO model)
  - 80 COCO object classes
  - ~6MB download
  - Input: 640x640 RGB image
  - Output: Bounding boxes + class probabilities

### How It Works

1. User uploads photo
2. User enables ML checkbox
3. App loads ONNX Runtime (if not already loaded)
4. App loads YOLOv8n model (if not already loaded)
5. Photo is preprocessed (resized to 640x640, normalized)
6. ML inference runs (2-5 seconds)
7. Detected objects are filtered by:
   - Confidence > 50%
   - Object class is "platformable"
   - Bounding box size > minimum
8. Bounding boxes are converted to platforms
9. Platforms are merged with grid-detected platforms
10. Final platforms are validated for gameplay

### Fallback Strategy

The app tries multiple sources for each dependency:

**ONNX Runtime:**
1. Local: `lib/ort.min.js`
2. CDN: `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js`

**YOLOv8n Model:**
1. Local: `models/yolov8n.onnx`
2. CDN: `https://cdn.jsdelivr.net/gh/aspect-technology/yolov8-onnx@main/models/yolov8n.onnx`

If any source fails, the next one is tried automatically.

### Browser Requirements

- **WebAssembly support** (required)
  - All modern browsers (2017+)
  - Check: `typeof WebAssembly !== 'undefined'`

- **Service Worker support** (optional)
  - Enables offline caching
  - All modern browsers

- **SharedArrayBuffer** (optional)
  - Enables multi-threaded WASM (faster)
  - Requires HTTPS or localhost
  - Not strictly necessary

## Disabling ML Detection

ML detection is **disabled by default**. To keep it disabled:

1. Don't check the "ML object detection" checkbox
2. The runtime and model won't load
3. Game uses only grid-based platform detection

## File Size Reference

| File | Size | Required? |
|------|------|-----------|
| `ort.min.js` | ~300 KB | Yes (runtime) |
| `ort-wasm.wasm` | ~1.8 MB | Yes (fallback) |
| `ort-wasm-simd.wasm` | ~1.8 MB | Yes (preferred) |
| `yolov8n.onnx` | ~6 MB | Yes (model) |
| **Total** | **~10 MB** | **First load only** |

All files are cached after first load (via Service Worker).

## Support

If you encounter issues:

1. Check browser console (F12)
2. Copy error messages
3. Open an issue on GitHub with:
   - Browser name and version
   - Error messages from console
   - Steps to reproduce

## Future Improvements

Potential enhancements (not yet implemented):

- [ ] Support for custom YOLO models
- [ ] Adjustable confidence threshold in UI
- [ ] WebGL execution provider (faster but less compatible)
- [ ] Object detection preview before gameplay
- [ ] Platform editing/adjustment tools

---

**Remember:** ML detection is optional and experimental. The game works great without it using the grid-based detection method!

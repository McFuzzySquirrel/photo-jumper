# ONNX Loading Fix - Test Instructions

## ⚠️ IMPORTANT: Clear Service Worker First!

The old service worker is cached in your browser and MUST be cleared before testing.

### Option 1: Use the Clear Tool (Easiest)

1. Open: http://localhost:8080/clear-sw.html
2. Click "🗑️ Clear Service Worker & Cache"
3. Page will reload automatically
4. Proceed to testing below

### Option 2: Manual Clear

1. Press `F12` to open DevTools
2. Go to "Application" tab
3. Click "Service Workers" → "Unregister"
4. Click "Clear storage" → "Clear site data"
5. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

---

## Quick Test (Recommended)

Once cache is cleared:

1. Open: http://localhost:8080/test-onnx.html
2. Watch the page load
3. Should see: **✅ SUCCESS! ONNX is working correctly**

If successful, ONNX is ready to use!

---

## Full Test (In Main App)

1. Open: http://localhost:8080
2. Upload any photo
3. Check "ML object detection (experimental)" checkbox
4. Status should show:
   - "Loading runtime..." (2-3 seconds)
   - "Loading model..." (1-2 seconds)
   - "ML ready" ✅

---

## What You Should See in Console

Open DevTools (F12) → Console tab

### ✅ SUCCESS Pattern:
```
Attempting to load ONNX Runtime from: lib/ort.min.js
Attempting to load ONNX Runtime from: https://cdn.jsdelivr.net/...
ONNX Runtime loaded successfully from: https://cdn.jsdelivr.net/...
ONNX WASM path set to CDN: https://cdn.jsdelivr.net/...
Attempting to load model from: models/yolov8n.onnx
ONNX model loaded successfully from: models/yolov8n.onnx
```

### ❌ FAILURE Patterns:

**Old Service Worker Still Active:**
```
[SW] Failed to fetch: http://localhost:8080/lib/ort.min.js
TypeError: Failed to fetch (from service worker)
```
→ **Solution:** Clear service worker using steps above

**Network Error:**
```
Failed to load ONNX Runtime from all sources
```
→ **Solution:** Check internet connection (CDN needs network)

---

## What Was Fixed

The service worker was throwing errors when `lib/ort.min.js` didn't exist, preventing the JavaScript fallback from trying the CDN URL.

### Changes Made:

1. **Service Worker (sw.js)**:
   - Changed cache strategy to not throw errors on missing local files
   - Now lets 404s pass through naturally so JS fallback can work
   - Updated cache version to v2 to force refresh

2. **ONNX Runtime Loading (index.html)**:
   - Added proper WASM path configuration
   - Added 100ms delay after script load for initialization
   - Removed 'webgl' execution provider (less stable)
   - Enhanced error logging

3. **Meta Tags (index.html)**:
   - Added `mobile-web-app-capable` meta tag

---

## Expected Behavior

### First Load (No Cache):
1. Browser tries `lib/ort.min.js` → 404 (expected, no error)
2. Browser tries CDN → Downloads ~2MB
3. Service worker caches CDN files
4. Model loads from local `models/yolov8n.onnx`
5. Status: "ML ready"

### Second Load (Cached):
1. Browser tries `lib/ort.min.js` → 404 (expected)
2. Browser tries CDN → Loads from cache ⚡
3. Model loads from cache
4. Status: "ML ready" (much faster!)

### Offline (Everything Cached):
1. Runtime loads from cache
2. Model loads from cache
3. Works completely offline

---

## Troubleshooting

### Still seeing service worker errors?

**Most common issue:** Old service worker still active

**Solution:**
1. Go to http://localhost:8080/clear-sw.html
2. Click "Clear Service Worker & Cache"
3. Wait for reload
4. Try again

### "ML ready" appears but no objects detected?

**Possible causes:**
- Photo doesn't contain detectable objects (furniture, vehicles, electronics)
- Confidence threshold too high

**Solution:**
- Enable "Debug overlay" checkbox
- Look for red boxes (detected objects)
- Try photo with clear furniture/vehicles

### Model loads slowly?

**Normal behavior:**
- First load: 3-5 seconds (downloading from CDN)
- Subsequent loads: <1 second (cached)

---

## File Downloads (First Load Only)

| File | Source | Size | Cached? |
|------|--------|------|---------|
| ort.min.js | CDN | ~300 KB | ✅ Yes |
| ort-wasm-simd.wasm | CDN | ~1.8 MB | ✅ Yes |
| yolov8n.onnx | Local | ~6 MB | ✅ Yes |

**Total first-time download:** ~2.1 MB (model is local, only runtime from CDN)

---

## Success Checklist

- [ ] Cleared service worker cache
- [ ] test-onnx.html shows "SUCCESS"
- [ ] No service worker errors in console
- [ ] "ML ready" status appears in main app
- [ ] Can toggle ML on/off without errors
- [ ] Works after page refresh (cached)

---

## Still Having Issues?

Share the **complete console log** including:
- All "Attempting to load..." messages
- Any error messages with full stack traces
- Service worker logs (marked with [SW])

**Remember:** ML detection is optional. The game works perfectly without it using grid-based platform detection!


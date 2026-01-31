# ADR 0006: Cross-Platform Packaging Strategy

- Status: Proposed
- Date: 2026-01-31

## Context

Photo Jumper is currently a single-file HTML5 game (`index.html`) with an optional Express server (`server.js`) for LAN feedback collection. The question has been raised: should we package this into a standalone application that works as:

1. A web server app (current approach)
2. A desktop standalone app (Windows, macOS, Linux)
3. A mobile app (iOS, Android)

The current architecture has these characteristics:
- **Single-file philosophy**: The game is entirely contained in `index.html` (HTML, CSS, JavaScript)
- **No build pipeline**: Works by simply opening the file in a browser
- **Optional server**: `server.js` only provides feedback collection on LAN
- **Web technologies**: Uses HTML5 Canvas, Web APIs for file/camera access
- **ML features**: Optional ONNX-based object detection loaded from CDN/local files

## Decision Drivers

1. **Maintain simplicity**: The single-file philosophy is a core feature
2. **Offline capability**: Users want to play without internet
3. **Distribution ease**: Should be easy to share and install
4. **ML integration**: ONNX model loading has CORS requirements
5. **Development overhead**: Minimal additional complexity preferred
6. **Learning focus**: This is an experimental/learning project

## Options Considered

### Option 1: Progressive Web App (PWA) - **Recommended**

Transform the current web app into an installable PWA.

**Implementation:**
- Add a `manifest.json` for app metadata
- Add a Service Worker for offline caching
- Bundle the ONNX model and runtime for offline ML

**Pros:**
- ✅ Minimal changes to existing architecture
- ✅ Single codebase serves web, desktop, and mobile
- ✅ "Install" button appears in browsers automatically
- ✅ Works offline after first visit
- ✅ No app store approval needed
- ✅ Updates automatically
- ✅ Maintains single-file philosophy (manifest/SW are small additions)

**Cons:**
- ❌ Limited access to native device features
- ❌ No presence in app stores (could use PWABuilder for stores)
- ❌ iOS Safari has some PWA limitations

**Effort**: Low (1-2 days)

### Option 2: Electron (Desktop)

Package the web app in Electron for desktop distribution.

**Implementation:**
- Add Electron as a dev dependency
- Create main process script to load `index.html`
- Package for Windows, macOS, Linux

**Pros:**
- ✅ Full desktop app experience
- ✅ Access to Node.js APIs
- ✅ Can bundle everything including ONNX model
- ✅ Works completely offline

**Cons:**
- ❌ Large bundle size (~150MB+ per platform)
- ❌ Chromium included = security update burden
- ❌ Desktop only (need separate mobile solution)
- ❌ Significant departure from single-file philosophy
- ❌ Requires build pipeline

**Effort**: Medium (3-5 days)

### Option 3: Tauri (Desktop, lighter alternative)

Use Tauri instead of Electron for smaller desktop apps.

**Implementation:**
- Add Tauri CLI and config
- Uses system WebView instead of bundled Chromium

**Pros:**
- ✅ Much smaller bundle size (~10-20MB)
- ✅ Better security model than Electron
- ✅ Lower memory usage
- ✅ Rust-based backend if needed

**Cons:**
- ❌ Requires Rust toolchain for development
- ❌ Desktop only
- ❌ System WebView varies by OS (potential compatibility issues)
- ❌ Still requires build pipeline

**Effort**: Medium (3-5 days)

### Option 4: Capacitor (Mobile)

Use Capacitor to package for iOS and Android.

**Implementation:**
- Add Capacitor configuration
- Build native shells for iOS/Android
- Wrap the existing web app

**Pros:**
- ✅ Relatively easy to add to existing web app
- ✅ Access to native device features (camera, file system)
- ✅ Can submit to app stores
- ✅ Same codebase for web and mobile

**Cons:**
- ❌ Requires Xcode (iOS) and Android Studio
- ❌ App store submission process
- ❌ Needs separate desktop solution
- ❌ Build/release complexity

**Effort**: Medium-High (5-7 days)

### Option 5: Hybrid (PWA + Optional Native)

Start with PWA, add native packaging later if needed.

**Implementation:**
1. Phase 1: Implement PWA (immediate value)
2. Phase 2: Add Tauri/Capacitor if native features needed

**Pros:**
- ✅ Progressive enhancement approach
- ✅ Immediate offline capability
- ✅ Can add native features incrementally
- ✅ Data-driven decision on native investment

**Cons:**
- ❌ May need to revisit architecture later
- ❌ Multiple packaging approaches to maintain

**Effort**: Low initially, increases with native additions

## Recommendation

**Start with PWA (Option 1)** for the following reasons:

1. **Minimal disruption**: Aligns with single-file philosophy
2. **Cross-platform**: Works on desktop AND mobile from single codebase
3. **Low effort**: Can be implemented in 1-2 days
4. **Solves core problems**:
   - Offline play ✅
   - Easy installation ✅
   - ML model bundling ✅
5. **Future-proof**: Can add native packaging later if truly needed

### PWA Implementation Plan

1. **Create `manifest.json`**:
   ```json
   {
     "name": "Photo Jumper",
     "short_name": "PhotoJump",
     "description": "Turn photos into playable platformer levels",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#667eea",
     "theme_color": "#764ba2",
     "icons": [...]
   }
   ```

2. **Create Service Worker** (`sw.js`):
   - Cache `index.html`, manifest, icons
   - Cache ONNX runtime and model for offline ML
   - Network-first strategy with offline fallback

3. **Register Service Worker** in `index.html`:
   ```javascript
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js');
   }
   ```

4. **Create app icons** (multiple sizes for different platforms)

5. **Update `index.html`**:
   - Add manifest link
   - Add theme-color meta tag
   - Add apple-touch-icon for iOS

### When to Consider Native Packaging

Consider Tauri (desktop) or Capacitor (mobile) if:
- Users report PWA installation friction
- Need native features not available in web (e.g., push notifications, background processing)
- App store presence becomes important
- Performance bottlenecks require native code

## Consequences

### Positive

- Game becomes installable and works offline
- No app store dependencies
- Single codebase for all platforms
- Maintains project simplicity
- ML detection works offline when model is cached

### Negative

- Slight increase in project files (manifest, service worker, icons)
- iOS Safari PWA experience is slightly limited
- No app store discoverability (unless using PWABuilder later)

## References

- [PWA Overview (web.dev)](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Tauri](https://tauri.app/)
- [Capacitor](https://capacitorjs.com/)
- [PWABuilder](https://www.pwabuilder.com/) - For generating app store packages from PWAs

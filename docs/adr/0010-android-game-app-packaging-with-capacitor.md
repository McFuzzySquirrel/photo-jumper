# ADR 0010: Android Game App Packaging with Capacitor

- Status: Accepted
- Date: 2026-02-12

## Context

Photo Jumper is a web-based platformer game where players upload photos and the game generates playable levels using ML-based object detection (ONNX Runtime Web with YOLOv8n). The game currently runs as a PWA (Progressive Web App) with service worker caching, offline support, and installability.

The project now aims to create a dedicated Android game app from the ML-only version of the game. This requires:

1. A native Android shell to wrap the existing web game
2. Access to native device features (camera, haptics, screen orientation)
3. Play Store distribution capability
4. Game-optimized touch UX (not generic web UI)
5. Offline ML inference with bundled ONNX model

ADR 0006 previously evaluated cross-platform packaging options (PWA, Electron, Tauri, Capacitor, Hybrid) and recommended PWA as the initial approach. The PWA has been implemented. This ADR extends that decision for dedicated Android game app packaging.

## Decision Drivers

1. **Game UX quality**: Touch controls must feel native and responsive for a platformer
2. **Native API access**: Camera, haptics, screen orientation lock, immersive mode
3. **Code reuse**: Maximize reuse of existing web game codebase
4. **Play Store readiness**: Must produce a valid AAB/APK for Google Play Store
5. **Offline capability**: ML model must work without internet
6. **Development effort**: Minimize new tooling and platform-specific code
7. **Performance**: 60fps gameplay on mid-range Android devices
8. **Maintainability**: Single codebase for web and Android where possible

## Options Considered

### Option 1: Capacitor (Recommended)

Wrap the existing web game in a native Android shell using Ionic Capacitor.

**Pros:**
- ✅ Drop-in wrapper for existing web app (no rewrite)
- ✅ Rich plugin ecosystem: Camera, Haptics, Screen Orientation, Status Bar, Splash Screen, App lifecycle
- ✅ Generates a standard Android Studio project (Gradle, AAB output)
- ✅ WebView is hardware-accelerated (Canvas games run well)
- ✅ Can bundle ONNX model in APK assets for offline use
- ✅ JavaScript ↔ native bridge for future native features
- ✅ Supports both Android and iOS from same project (future-proof)
- ✅ Active community and Ionic backing
- ✅ Minimal build pipeline (no webpack/vite required)

**Cons:**
- ❌ Requires Android Studio for building/testing
- ❌ WebView rendering, not truly native UI
- ❌ APK includes WebView overhead (~5-10MB baseline)
- ❌ WASM performance in WebView slightly lower than Chrome
- ❌ Debugging requires Chrome DevTools remote inspection

**Effort**: Medium (5-7 days for initial Android build with UX refactoring)

### Option 2: Trusted Web Activity (TWA)

Package the PWA as a TWA using Bubblewrap or PWABuilder.

**Pros:**
- ✅ Smallest wrapper (~2MB overhead)
- ✅ Uses full Chrome engine (best web performance)
- ✅ Automatic updates when web app updates
- ✅ Minimal code changes

**Cons:**
- ❌ Requires Chrome installed on device
- ❌ No native API access (no haptics, no native camera)
- ❌ Cannot bundle ONNX model in APK (relies on CDN/service worker)
- ❌ Limited lifecycle control
- ❌ Feels like a "wrapped website" not a game
- ❌ No back button customization

**Effort**: Low (1-2 days)

### Option 3: Custom WebView Wrapper

Create a minimal Android app with a WebView that loads the game.

**Pros:**
- ✅ Full control over native code
- ✅ No framework dependency
- ✅ Can add any native feature

**Cons:**
- ❌ Must implement all bridges manually
- ❌ Service Worker support requires WebViewClient configuration
- ❌ Camera bridge requires significant native code
- ❌ No plugin ecosystem
- ❌ Higher maintenance burden

**Effort**: Medium-High (7-10 days)

### Option 4: React Native / Flutter Rewrite

Rewrite the game in a cross-platform mobile framework.

**Pros:**
- ✅ Truly native UI and performance
- ✅ Access to all device features
- ✅ Hot-reload development

**Cons:**
- ❌ Complete rewrite of game logic, rendering, and ML pipeline
- ❌ Canvas 2D games don't map well to React Native/Flutter
- ❌ ONNX Runtime integration differs significantly
- ❌ Months of effort instead of weeks
- ❌ Two codebases to maintain

**Effort**: Very High (2-3 months)

## Decision

**Use Capacitor (Option 1)** for the following reasons:

1. **Best native access with minimal rewrite**: Camera, haptics, orientation lock, and immersive mode are all available via plugins, requiring only JavaScript bridge calls
2. **Preserves game architecture**: The Canvas-based rendering, ONNX ML pipeline, and physics engine all work as-is in the Capacitor WebView
3. **Play Store ready**: Produces standard Gradle project with AAB output
4. **Offline ML**: ONNX model can be bundled in APK assets and loaded without network
5. **Future iOS support**: Same Capacitor project supports iOS with `npx cap add ios`
6. **Ecosystem alignment**: ADR 0006 already identified Capacitor as the recommended mobile packaging approach

### Key Capacitor Plugins Required

| Plugin | Purpose |
|--------|---------|
| `@capacitor/camera` | Native camera capture and photo gallery access |
| `@capacitor/haptics` | Vibration feedback on game events |
| `@capacitor/screen-orientation` | Lock to landscape during gameplay |
| `@capacitor/status-bar` | Hide for immersive mode |
| `@capacitor/splash-screen` | Native launch screen |
| `@capacitor/app` | Back button handling, app lifecycle |
| `@capacitor/filesystem` | Access bundled ONNX model from assets |

## Consequences

### Positive

- Android game app installable from Play Store
- Native-feeling touch controls with haptic feedback
- ML detection works offline with bundled model
- Single codebase serves both web PWA and Android app
- Path to iOS app with minimal additional work
- No game logic rewrite required

### Negative

- Android Studio required for development and builds
- WebView performance is ~90% of native Chrome (acceptable for 2D Canvas game)
- APK size increases by ~5-10MB for Capacitor shell + bundled ONNX model (~6MB)
- Debugging requires Chrome remote DevTools
- Must maintain Capacitor version compatibility with Android SDK updates

### Neutral

- UI needs refactoring regardless of packaging choice (mobile game UX improvements)
- ML-only mode simplification is independent of packaging decision
- Touch control overhaul benefits both web PWA and Android app

## References

- [ADR 0006: Cross-Platform Packaging Strategy](0006-cross-platform-packaging-strategy.md) — Prior analysis
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Game Development Guidelines](https://developer.android.com/games)
- [Material Design Touch Targets](https://m3.material.io/foundations/accessible-design/accessibility-basics)
- [PRD: Android Game App Plan](../prd/android-game-app-plan.md) — Detailed implementation plan

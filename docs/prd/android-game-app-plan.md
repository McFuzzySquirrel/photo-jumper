# PRD: Android Game App — Photo Jumper ML-Only Edition

## Summary

Package the ML-only version of Photo Jumper as a native-feeling Android game app, using Capacitor (or TWA as a lightweight alternative) to wrap the existing web game. The primary focus is making the mobile game UX intuitive, responsive, and store-ready, with particular emphasis on touch controls, game flow, and Android-specific optimizations.

## Goals

1. **Android-native game experience**: Install from Play Store, launch like any game, landscape-optimized
2. **Intuitive touch UX**: Game controls designed for thumbs, not mouse pointers
3. **ML-only pipeline**: Default to ML-only detection mode (no grid toggle complexity for end users)
4. **Simplified game flow**: Photo → Play → Win, with minimal setup screens
5. **Offline-capable**: ONNX model bundled, no CDN dependency required
6. **Store-ready**: Proper icons, splash screens, metadata, and Play Store compliance

## Non-Goals (Phase 1)

- iOS support (deferred, but architecture should not preclude it)
- In-app purchases or ads
- Multiplayer or online leaderboards
- Custom model training or model swapping
- Depth estimation or AR features

---

## Research Findings

### Packaging Approach Comparison

| Approach | Pros | Cons | Effort |
|----------|------|------|--------|
| **Capacitor** (Recommended) | Native shell, access to camera/file APIs, Play Store ready, same web codebase, plugin ecosystem | Requires Android Studio, build pipeline, ~5-7 days initial setup | Medium |
| **TWA (Trusted Web Activity)** | Smallest wrapper, Chrome-powered, auto-updates from web | Requires hosted URL, limited offline, no native API access, Chrome dependency | Low |
| **WebView wrapper** | Simple, no framework needed | No service worker support, limited APIs, poor performance | Low |
| **Full native rewrite** | Best performance, full platform access | Completely new codebase, very high effort | Very High |

**Decision: Capacitor** — It provides the best balance of native access (camera, filesystem, haptics), Play Store compatibility, and code reuse. The existing web game runs inside a native WebView with bridge access to native plugins.

### Mobile Game UX Research: Touch Platformer Best Practices

Based on established patterns from successful mobile platformers (e.g., Super Mario Run, Rayman Adventures, Geometry Dash, Oddmar):

#### 1. Control Schemes That Work on Mobile

| Pattern | Description | Best For |
|---------|-------------|----------|
| **Floating joystick + action buttons** | Virtual joystick appears where thumb touches (left side), jump button on right | Complex movement games |
| **Fixed thumb zones** | Left third = move left, right third = move right, tap anywhere = jump | Simple platformers ✅ |
| **Auto-run + jump** | Character runs automatically, player only controls jumping | Endless runners |
| **Gesture-based** | Swipe left/right to move, tap to jump, swipe up for high jump | Casual games |

**Recommendation for Photo Jumper**: **Fixed thumb zones with dedicated jump button** — this matches the existing ◀ ▲ ▶ button pattern but needs to be dramatically larger and better positioned for comfortable gameplay.

#### 2. Control Sizing & Positioning (Critical for Android)

- **Minimum touch target**: 48dp × 48dp (Android Material Design guideline)
- **Recommended game button size**: 64-80dp for frequently used controls
- **D-pad / movement buttons**: Bottom-left corner, thumb-reachable
- **Jump button**: Bottom-right corner, larger than movement buttons (primary action)
- **HUD elements**: Top of screen, outside thumb zones, semi-transparent
- **Safe areas**: Respect Android navigation bar, notches, and camera cutouts

#### 3. Game Flow Optimizations

**Current flow (too many steps for mobile):**
```
Splash → Intro → Game Screen → Upload/Camera → Fullscreen → Play
```

**Recommended Android flow:**
```
Splash (1s auto) → Main Menu → [Take Photo] or [Choose Photo] → Loading/ML → Play
```

Key changes:
- Remove intro features screen (not needed for installed app)
- Auto-enter fullscreen (it's always fullscreen on Android)
- Camera button is primary CTA (most common mobile use case)
- Gallery/upload is secondary option
- ML loading shows progress bar with game tips
- No debug/grid toggles in main UI (move to Settings)

#### 4. Visual Feedback & Game Feel

- **Haptic feedback** on jump, landing, letter collection, and goal reach (Capacitor Haptics plugin)
- **Screen shake** on landing from high falls
- **Particle effects** for letter collection and goal celebration
- **Sound effects** for key actions (can be added later)
- **Button press states**: Visual scale + haptic pulse on touch controls
- **Loading animations**: Engaging ML loading screen with tips about the game

#### 5. Performance Considerations for Android

- **Target**: 60fps on mid-range Android devices (Snapdragon 600-series)
- **Canvas rendering**: Hardware-accelerated in WebView
- **ONNX inference**: WASM backend on Android WebView (no WebGPU yet on most devices)
- **Model bundling**: Include ONNX model in APK assets (~6MB for YOLOv8n)
- **Image resizing**: Downscale photos before ML inference to reduce memory usage
- **Battery**: Pause game loop when app is backgrounded

---

## Current UI Audit: Android Readiness Gaps

### Critical Issues (Must Fix)

| # | Issue | Current State | Required State |
|---|-------|--------------|----------------|
| 1 | **Touch controls too small** | 27.5px buttons (≈14dp), 50% opacity | 64-80dp, full opacity, positioned for thumb zones |
| 2 | **No dedicated game layout** | Shares layout with web/desktop | Fullscreen-only, no container/card UI |
| 3 | **Too many setup steps** | Splash → Intro → Game → Upload → Play | Splash → Menu → Photo → Play |
| 4 | **ML mode hidden in settings** | Checkbox buried in instructions | ML-only is the default and only mode |
| 5 | **No haptic feedback** | Silent touch interactions | Haptic pulse on jump, collect, win |
| 6 | **Debug controls in main UI** | Debug/ML toggles visible to all users | Move to hidden Settings/Developer menu |
| 7 | **Desktop-oriented instructions** | References keyboard controls | Touch-only instructions or in-game tutorial |
| 8 | **No landscape lock** | Attempts lock but falls back gracefully | Native landscape lock via Capacitor |
| 9 | **Score/word bar overlap potential** | Fixed positioning may conflict with notches | Use Android safe area insets |
| 10 | **No back button handling** | Browser back navigates away | Android back = pause/menu, not exit |

### Moderate Issues (Should Fix)

| # | Issue | Current State | Required State |
|---|-------|--------------|----------------|
| 11 | **No pause menu** | No way to pause mid-game | Pause button + overlay with Resume/Restart/Home |
| 12 | **Zoom controls cluttered** | 6 small buttons in a row | Pinch-to-zoom or simplified +/- only |
| 13 | **Win screen basic** | Simple alert-style | Celebratory screen with stats and replay button |
| 14 | **No onboarding** | Text instructions | Interactive first-play tutorial overlay |
| 15 | **Camera button not prominent** | Same size as other buttons | Large primary CTA button |
| 16 | **No loading progress for ML** | Status text only | Visual progress bar with percentage |

### Nice-to-Have (Phase 2)

| # | Issue | Current State | Required State |
|---|-------|--------------|----------------|
| 17 | **No photo gallery** | One photo at a time | Save/replay previous levels |
| 18 | **No achievements** | Score only | Achievement badges for milestones |
| 19 | **No share feature** | No social sharing | Share level screenshots to social media |
| 20 | **No sound** | Silent game | Sound effects and optional background music |

---

## Refactoring Plan

### Phase 0: Project Setup (Capacitor Integration)

**Estimated effort: 1-2 days**

1. Initialize Capacitor in existing project
   ```bash
   npm install @capacitor/core @capacitor/cli
   npx cap init "Photo Jumper" com.photojumper.game --web-dir .
   npx cap add android
   ```

2. Configure `capacitor.config.ts`:
   - Set `webDir` to project root (no build step)
   - Configure Android WebView settings for game performance
   - Enable hardware acceleration
   - Set `allowMixedContent` for CDN model loading fallback

3. Bundle ONNX model in Android assets (avoid CDN dependency)

4. Add Capacitor plugins:
   - `@capacitor/camera` — Native camera access
   - `@capacitor/filesystem` — Photo access
   - `@capacitor/haptics` — Vibration feedback
   - `@capacitor/status-bar` — Hide status bar for immersive mode
   - `@capacitor/screen-orientation` — Lock to landscape
   - `@capacitor/splash-screen` — Native splash screen
   - `@capacitor/app` — Back button handling, lifecycle events

5. Android project configuration:
   - `AndroidManifest.xml`: Camera permission, landscape orientation, immersive mode
   - `build.gradle`: Target SDK, min SDK (26+), signing config
   - Adaptive icons for Android (foreground + background layers)

### Phase 1: UI Refactoring for Android Game UX

**Estimated effort: 3-5 days**

#### 1.1 Game Layout Restructure

- Create new CSS mode: `android-game` that activates when running in Capacitor
  ```javascript
  // Detect Capacitor native environment
  const isNativeApp = window.Capacitor?.isNativePlatform();
  if (isNativeApp) document.body.classList.add('native-app');
  ```
- Remove container card styling (white box, shadows, border-radius)
- Canvas fills entire screen by default (no fullscreen toggle needed)
- Implement Android safe area insets for UI overlays
  ```css
  .game-hud { padding-top: env(safe-area-inset-top); }
  ```

#### 1.2 Touch Controls Overhaul

- **Movement controls** (bottom-left thumb zone):
  - D-pad style: Left and Right buttons, 64dp each
  - Semi-transparent background, full opacity on press
  - Position: 16dp from bottom, 16dp from left edge
  - Spacing: 8dp gap between buttons

- **Jump button** (bottom-right thumb zone):
  - Circular, 80dp diameter (larger = primary action)
  - Distinct color (pink/red gradient, matching current jump-btn)
  - Position: 16dp from bottom, 16dp from right edge
  - Hold detection for variable-height jump (existing mechanic)

- **Action buttons** (top-right, smaller):
  - Pause button: 40dp, always visible
  - Regenerate (G): 40dp, in pause menu instead of HUD
  - Respawn (R): 40dp, quick-access in HUD

- Remove desktop-only controls:
  - Exit fullscreen button (always fullscreen)
  - Zoom ⊙ reset button (simplify to pinch-to-zoom only)
  - Keyboard instruction references

#### 1.3 Game Flow Simplification

**New screen flow:**

```
Native Splash (Capacitor, 1.5s)
    ↓
Main Menu Screen
    ├── 📷 "Take Photo" (primary, large CTA)
    ├── 📁 "Choose Photo" (secondary)
    ├── ⚙️ Settings (gear icon, top-right)
    └── ℹ️ How to Play (first-time only, dismissible)
    ↓
ML Loading Screen
    ├── Progress bar (model loading + inference)
    ├── Game tip carousel
    └── Cancel button
    ↓
Gameplay Screen
    ├── HUD: Score, Time, Word Bar
    ├── Touch controls: D-pad left, Jump right
    ├── Pause button (top-right)
    └── [Win] → Victory Screen
    ↓
Victory Screen
    ├── Stats: Score, Time, Word completion
    ├── 🔄 "Play Again" (same photo, regenerate)
    ├── 📷 "New Photo"
    └── 🏠 "Main Menu"
```

**State machine changes in main.js:**
- Remove intro screen (features overview not needed for installed game)
- Auto-skip splash or use native Capacitor splash
- Main menu replaces the current game screen upload section
- Add pause state and victory state

#### 1.4 ML-Only as Default

- Remove ML toggle checkboxes from main game UI
- ML-only mode is always active in Android build
- Grid detection kept as internal fallback only (not user-facing)
- Move debug toggles to Settings → Developer Options (hidden by default)
- Detection mode badge simplified: just show "Detecting objects..." during inference

#### 1.5 HUD & Overlay Redesign

- **Score**: Top-center, larger font, game-styled (not plain text)
- **Word bar**: Top-left, compact pill design, safe-area aware
- **Timer**: Integrated with score display
- **Detection badge**: Only during loading, then auto-dismiss

### Phase 2: Native Integration & Polish

**Estimated effort: 2-3 days**

#### 2.1 Haptic Feedback

```javascript
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// On jump
Haptics.impact({ style: ImpactStyle.Light });

// On letter collection
Haptics.impact({ style: ImpactStyle.Medium });

// On goal reached / win
Haptics.notification({ type: 'SUCCESS' });
```

#### 2.2 Native Camera Integration

Replace `<input type="file" capture>` with Capacitor Camera plugin:
```javascript
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

const photo = await Camera.getPhoto({
    quality: 80,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera, // or CameraSource.Photos
    width: 1280,
    height: 960,
});
```

Benefits:
- Native camera UI (faster, more reliable)
- Automatic image downsizing (save memory/inference time)
- Access to photo gallery without file picker

#### 2.3 Android Lifecycle Management

- Pause game loop on `appStateChange` (background)
- Resume game loop on foreground
- Handle Android back button: Pause → Menu, not exit
- Save/restore game state on pause (optional Phase 2)

#### 2.4 Screen Orientation & Immersive Mode

- Lock to landscape via Capacitor Screen Orientation plugin
- Hide status bar and navigation bar (immersive sticky mode)
- Handle orientation changes gracefully

#### 2.5 Pause Menu

New overlay when pause button tapped or Android back pressed:
- Semi-transparent dark overlay
- Resume button (primary)
- Restart Level
- New Photo
- Settings
- Main Menu

### Phase 3: Store Preparation

**Estimated effort: 2-3 days**

#### 3.1 Play Store Assets

- App icon: Adaptive icon (foreground + background layers)
- Feature graphic: 1024×500 promotional banner
- Screenshots: Phone (16:9) and tablet (various)
- Short description (80 chars): "Turn your photos into playable platformer levels!"
- Full description (4000 chars): Game features, how to play, privacy info

#### 3.2 Store Compliance

- Privacy policy URL (all processing is local — strong privacy story)
- Content rating questionnaire (E for Everyone)
- Target API level (Android 14+ target, Android 8.0+ min)
- 64-bit support (Capacitor handles this)
- Ads declaration (none)
- Data safety form (camera permission, no data collection)

#### 3.3 Build & Signing

- Generate release keystore
- Configure Gradle signing config
- Build AAB (Android App Bundle) for Play Store
- Internal testing track setup
- Version management strategy

#### 3.4 Performance Testing

- Profile on low-end device (2GB RAM, Snapdragon 400-series)
- Profile on mid-range device (4GB RAM, Snapdragon 600-series)
- Measure ML inference time on target devices
- Battery consumption test (30-minute play session)
- Memory usage monitoring (especially during ML inference)

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor project configuration |
| `android/` | Generated Android project (Capacitor) |
| `js/ui/game-menu.js` | Main menu screen logic |
| `js/ui/pause-menu.js` | Pause overlay logic |
| `js/ui/victory-screen.js` | Win screen with stats |
| `js/ui/hud.js` | Refactored HUD (score, word bar, timer) |
| `js/platform/native-bridge.js` | Capacitor plugin wrappers (camera, haptics, etc.) |
| `css/android-game.css` | Android-specific game styling overrides |

### Modified Files

| File | Changes |
|------|---------|
| `index.html` | Add android-game layout, restructure screens, enlarge touch controls |
| `js/main.js` | Simplify game flow, add pause/victory states, native detection |
| `js/config.js` | Add mobile control sizing constants, Android defaults |
| `manifest.json` | Update orientation to landscape, add Android-specific fields |
| `package.json` | Add Capacitor dependencies and build scripts |
| `sw.js` | Update cache list for new module files |

### Removed/Hidden

| Element | Action |
|---------|--------|
| Intro features screen | Remove (not needed for installed game) |
| ML toggle checkbox | Move to Settings → Developer Options |
| Debug overlay checkbox | Move to Settings → Developer Options |
| Grid-only mode | Remove from UI (keep as internal fallback) |
| Exit fullscreen button | Remove (always fullscreen) |
| LAN hint section | Remove (not applicable for native app) |
| Feedback modal | Replace with in-app feedback or remove |
| Desktop keyboard instructions | Replace with touch-only instructions |

---

## Architecture Decisions

### Why Capacitor over TWA

1. **Native camera access**: TWA relies on web APIs; Capacitor gives native camera UI
2. **Haptic feedback**: Not available in TWA
3. **Offline model bundling**: APK can include ONNX model in assets
4. **Back button handling**: Native lifecycle management
5. **Immersive mode**: Full control over system UI
6. **Future-proof**: Can add native modules (e.g., TFLite for faster inference)

### Why Not a Full Native Rewrite

1. **Code reuse**: 95% of game logic works as-is in WebView
2. **Development speed**: Weeks vs. months
3. **Maintainability**: Single codebase for web and Android
4. **Canvas performance**: WebView Canvas is hardware-accelerated, sufficient for 2D platformer
5. **ONNX Runtime Web**: Already working; native ONNX would require separate integration

### Why ML-Only as Default for Android

1. **Simplicity**: One mode = less confusion for mobile users
2. **Differentiation**: ML detection is the unique selling point
3. **Fallback chain**: Already handles ML-sparse photos automatically
4. **Performance**: Grid detection adds minimal value when ML + fallbacks exist

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| WebView performance on low-end devices | Medium | High | Profile early, reduce particle effects, throttle ML resolution |
| ONNX WASM slow on old Android | Medium | Medium | Set min SDK to Android 8.0, test on target devices, add timeout |
| Play Store rejection | Low | Medium | Follow guidelines strictly, prepare appeal |
| Touch controls feel unresponsive | Medium | High | Test extensively, add haptic feedback, tune touch thresholds |
| Large APK size (ONNX model) | Low | Low | YOLOv8n is only ~6MB, total APK should be <20MB |
| Memory issues on 2GB devices | Medium | Medium | Downscale photos, limit canvas size, release ML resources after inference |

---

## Success Metrics

1. **Installation**: APK installs and launches on Android 8.0+ devices
2. **Performance**: 60fps during gameplay on mid-range devices (Snapdragon 600+)
3. **ML inference**: < 8 seconds on mid-range, < 15 seconds on low-end
4. **Touch controls**: Player can complete a level using only touch controls
5. **Game flow**: Photo → Play in ≤ 3 taps
6. **Store ready**: Passes Play Store pre-launch report with no critical issues

---

## Milestones & Timeline

| Milestone | Duration | Dependencies |
|-----------|----------|--------------|
| **M0**: Capacitor setup + Android project | 1-2 days | Node.js, Android Studio |
| **M1**: UI refactoring (layout, controls, flow) | 3-5 days | M0 |
| **M2**: Native integration (camera, haptics, lifecycle) | 2-3 days | M1 |
| **M3**: Polish & playtesting | 2-3 days | M2 |
| **M4**: Store preparation & submission | 2-3 days | M3 |
| **Total** | **10-16 days** | |

---

## Appendix: Touch Control Layout Diagram

```
┌────────────────────────────────────────────────────┐
│ [Word: J U M P]          [Score: 150 | 23s]   [⏸] │  ← HUD (safe area)
│                                                    │
│                                                    │
│                    GAME CANVAS                     │
│                 (full screen)                      │
│                                                    │
│                                                    │
│                                                    │
│                                                    │
│  ┌────┐ ┌────┐                          ┌──────┐  │
│  │ ◀  │ │ ▶  │            [R]           │  ▲   │  │  ← Touch controls
│  │64dp│ │64dp│           40dp           │ 80dp │  │
│  └────┘ └────┘                          └──────┘  │
│  └─ Movement ─┘                      └─ Jump ─┘   │
└────────────────────────────────────────────────────┘
     Left thumb zone                Right thumb zone
```

## Appendix: Main Menu Layout

```
┌────────────────────────────────────────────────────┐
│                                              [⚙️]  │
│                                                    │
│                  [Photo Jumper Logo]                │
│                                                    │
│              Turn your photos into                 │
│            playable game levels!                   │
│                                                    │
│          ┌──────────────────────┐                   │
│          │   📷 Take a Photo    │  ← Primary CTA    │
│          └──────────────────────┘                   │
│                                                    │
│          ┌──────────────────────┐                   │
│          │   📁 Choose Photo    │  ← Secondary       │
│          └──────────────────────┘                   │
│                                                    │
│             [How to Play]  ← Link, first time      │
│                                                    │
└────────────────────────────────────────────────────┘
```

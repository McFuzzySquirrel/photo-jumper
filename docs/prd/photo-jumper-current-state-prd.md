# Photo Jumper Current-State PRD (As-Built + Remaining Work)

## 1. Overview

**Product Name:** Photo Jumper
**Summary:** Photo Jumper is a web-first platform game that turns user photos into playable block-based levels, with optional ML-assisted platform detection, reachability-aware level correction, letter collection scoring, and Android packaging via Capacitor.
**Target Platform:** Web browsers (desktop/mobile), installable PWA, Android app shell (Capacitor).
**Key Constraints:** Gameplay fairness over photo fidelity, deterministic and responsive jumping, 20px block grid, low-end/mobile performance, no photo upload to remote servers.

---

## 2. Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-30 | GitHub Copilot (GPT-5.3-Codex) | Initial current-state PRD from repository evidence |
| 1.1 | 2026-03-30 | project-architect agent | Phase 4 Task 4.3: Align docs with runtime — updated dependency versions (Express 5.2.1, ONNX 1.24.3, Capacitor 8.3), marked Phases 2–3 complete, noted YOLOv8n-seg interim segmentation, resolved key gaps and open questions |

---

## 3. Goals and Non-Goals

### 3.1 Goals
- Maintain a fun and fair platformer where visible geometry matches collision and jump expectations.
- Preserve privacy-first local photo processing for gameplay generation.
- Support both web/PWA usage and Android app packaging from one codebase.
- Keep level generation robust with ML + fallback paths and helper insertion.
- Keep architecture readable and modular for iterative development.

### 3.2 Non-Goals
- Full native engine rewrite (Unity/Godot) for current version.
- Multiplayer, cloud saves, or online leaderboard backend.
- Server-side image processing or user photo storage.
- Replacing core jump physics invariants unless explicitly re-scoped.

---

## 4. User Stories / Personas

### 4.1 Personas

| Persona | Description | Key Needs |
|---------|-------------|-----------|
| Casual Mobile Player | Wants a quick game from a camera photo | Fast load, obvious controls, fair jumps |
| Parent + Learner | Uses project for learning and experimentation | Understandable code, tunable behavior, visible progress |
| Project Maintainer | Evolves gameplay and architecture over time | Deterministic behavior, doc alignment, low regression risk |
| Contributor/Tester | Tests platform generation across devices/photos | Debug overlays, reproducible generation, clear acceptance checks |

### 4.2 User Stories

| ID | As a... | I want to... | So that... | Priority |
|----|---------|-------------|-----------|----------|
| US-01 | Casual Mobile Player | take or choose a photo and play quickly | I can start within seconds | Must |
| US-02 | Casual Mobile Player | trust that jumpable-looking platforms are actually jumpable | I do not feel cheated | Must |
| US-03 | Parent + Learner | tweak generation and controls safely | I can learn from experimentation | Should |
| US-04 | Maintainer | rely on modular detection and engine files | I can iterate without monolith breakage | Must |
| US-05 | Tester | inspect ML detections and platform geometry | I can diagnose generation problems | Should |
| US-06 | Player | collect letters and complete goals | I have clear progression and scoring | Must |

---

## 5. Research Findings

Repository evidence reviewed:
- Existing PRDs: docs/prd/ml-primary-architecture.md, docs/prd/android-game-app-plan.md
- ADRs: docs/adr/0001 through docs/adr/0010
- Runtime code: js/*, css/android-game.css, sw.js, capacitor.config.ts, server.js
- Dependency currency check via npm registry (2026-03-30)

### 5.1 What Is Implemented Today (Observed)
- Multi-file ES module architecture is in place (js/config.js, js/detection/*, js/engine/*, js/platform/native-bridge.js).
- Block-based platform system and gameplay constants are centralized.
- ML detection with ONNX Runtime Web 1.24.3 is implemented as optional mode, with YOLOv8n-seg instance segmentation (preferred) and YOLOv8n bounding-box detection (fallback), timeout handling, and CDN/local fallback chains.
- Fallback chain modules are implemented and functional (Hough via edge-density row scanning, edge-density via cell thresholding, skeleton via procedural stepping stones).
- Reachability and helper insertion logic is implemented in core game flow, including letter/goal placement safeguards.
- Android-native adaptation exists: native bridge wrappers, native-app CSS mode, pause/victory overlays, haptics hooks, landscape lock hooks.
- PWA/service worker offline caching is implemented, including model/runtime caching paths.
- LAN feedback server exists with local-only protections, optional token, and rate limiting.

### 5.2 Gaps Between Intended Architecture and Current Runtime
- Target model in strategy docs is YOLOE-26n-seg; runtime uses **YOLOv8n-seg** as an interim segmentation model (COCO 80-class, instance seg). The segmentation pipeline (mask coefficients × prototype masks → sigmoid → instance masks → stepped block platforms) is **fully implemented** in `js/detection/ml.js` and `js/detection/contours.js`. YOLOE-26n-seg will replace YOLOv8n-seg when it becomes available on a public CDN.
- ML default behavior in runtime is still off (`ML_DETECTION_ENABLED_DEFAULT = false`, `ML_ONLY_MODE_DEFAULT = false`), not fully ML-primary by default. This is intentional for web mode to avoid slow first-load experiences.
- Detection fallback modules are **verified complete** and functional:
  - `js/detection/hough.js` — Hough uses edge-density row scanning
  - `js/detection/edge-density.js` — Edge-density uses cell thresholding
  - `js/detection/skeleton.js` — Skeleton generates procedural stepping stones
  - `js/detection/contours.js` — Segmentation contour-to-platform pipeline (fully implemented)
- Documentation alignment task (Phase 4, Task 4.3) is addressing remaining doc drift from current code defaults.

### 5.3 Technology Currency (Checked)

| Technology | In Repo | Latest Stable Found | Status | Note |
|------------|---------|---------------------|--------|------|
| @capacitor/core | ^8.3.0 | 8.3.0 | ✅ Current | Upgraded in Phase 4, Task 4.1 |
| @capacitor/android | ^8.3.0 | 8.3.0 | ✅ Current | Aligned with Capacitor packages |
| express | ^5.2.1 | 5.2.1 | ✅ Current | Migrated from Express 4 in Phase 4, Task 4.1 |
| typescript | ^5.9.3 | 6.0.2 | Major behind | Evaluate tooling compatibility before upgrade |
| onnxruntime-web (CDN in code) | 1.24.3 | 1.24.3 | ✅ Current | Upgraded from 1.17.0 in Phase 4, Task 4.1 |

### 5.4 Tradeoff Summary

| Decision Area | Current Choice | Benefit | Cost / Risk |
|---------------|----------------|---------|-------------|
| Web-first architecture | No build-step core runtime | Fast iteration, easy teaching | Harder dependency/version control, inline style debt |
| Optional ML mode | ML can be toggled | Safe fallback behavior | Not fully aligned with ML-primary intent |
| Gameplay-first helper insertion | Adds supports if gaps risky | Fairness and completion reliability | More complex generation logic |
| Capacitor shell | Reuse web code on Android | Faster delivery vs native rewrite | WebView performance and plugin edge cases |

---

## 6. Concept

### 6.1 Core Loop / Workflow
1. User opens app (web, PWA, or native shell).
2. User selects/takes photo.
3. Detection pipeline generates candidate platforms (ML + fallback chain + helper insertion).
4. Reachability checks validate letters and goal path.
5. Player moves, jumps, collects letters, reaches portal.
6. Player respawns/regenerates if needed, then repeats.

### 6.2 Success / Completion Criteria
- Players can reliably complete levels generated from typical photos.
- Every required collectible and goal placement is reachable.
- Mobile controls feel usable on handheld devices.
- Offline/PWA mode works after first load.

---

## 7. Technical Architecture

### 7.1 Technology Stack

| Layer | Technology | Current Notes |
|-------|------------|---------------|
| UI/Game Runtime | Vanilla JS + HTML5 Canvas + ES Modules | Implemented in js/main.js + feature modules |
| Detection | ONNX Runtime Web 1.24.3 + YOLOv8n-seg (instance segmentation) + YOLOv8n (bbox fallback) | Segmentation pipeline fully implemented; YOLOE-26n-seg planned when available on CDN |
| Packaging | Capacitor 8.3 Android | Config and native bridge wrappers implemented; UX polished |
| Backend (local utility) | Node.js + Express 5.2 | LAN feedback endpoint + static hosting |
| Offline | Service Worker (v3) + Web App Manifest | Core asset and ML asset caching implemented |

### 7.2 Project Structure

| Area | Purpose |
|------|---------|
| js/engine | Player, platform, goal, letter systems |
| js/detection | ML detection, grid/fallback generators, combiners |
| js/platform | Native bridge wrappers (Capacitor plugins) |
| css | Android-specific UX overrides |
| docs/adr | Architectural decision history |
| docs/prd | Planning and product requirement docs |
| android | Native Android project artifacts |
| scripts | Utility scripts (feedback triage, docs tooling) |

### 7.3 Key APIs / Interfaces

| Interface | Role |
|-----------|------|
| initONNXModel / detectObjectsWithONNX | Runtime ML loading and inference |
| detectMasksWithONNX / computeInstanceMasks | Segmentation mask extraction from YOLOv8n-seg output |
| masksToTopContours / contoursToSteppedPlatforms | Contour extraction and block-aligned platform conversion (implemented) |
| evaluateMlPlatforms / combinePlatforms | ML-vs-fallback composition control |
| canReachPlatform / helper insertion routines in main flow | Reachability and fairness correction |
| native-bridge.js wrappers | Haptics, orientation, lifecycle, camera integration |
| /api/feedback endpoint | Local feedback ingestion with safeguards |

---

## 8. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01 | User can upload or capture a photo to generate a playable level. | Must |
| FR-02 | Platform generation snaps to 20px block grid and preserves clear collision boundaries. | Must |
| FR-03 | ML-assisted detection can create platforms from supported classes. | Must |
| FR-04 | If ML output is sparse, fallback chain contributes additional playable geometry. | Must |
| FR-05 | Goal placement is selected from reachable high-value candidates. | Must |
| FR-06 | Letter collectibles are placed only on reachable platforms. | Must |
| FR-07 | Helper platforms are inserted when traversal gaps exceed safe thresholds. | Must |
| FR-08 | Player supports variable jump height (tap short hop, hold full jump). | Must |
| FR-09 | Mobile and keyboard controls both allow full completion of levels. | Must |
| FR-10 | Native app mode exposes pause, restart, main-menu, and replay flows. | Should |
| FR-11 | Debug overlays can be enabled for diagnostics without breaking gameplay. | Should |
| FR-12 | Regeneration (G) and respawn (R) are available as recovery actions. | Must |

---

## 9. Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NF-01 | Maintain responsive gameplay target near 60fps on modest devices. | Must |
| NF-02 | Keep per-photo ML inference bounded by timeout to avoid indefinite stalls. | Must |
| NF-03 | Preserve deterministic level behavior for the same input + config. | Should |
| NF-04 | Keep module boundaries clear between detection, engine, and platform integration. | Must |
| NF-05 | Ensure offline/PWA experience works after initial caching. | Must |
| NF-06 | Keep generated platform count clamped for performance safety. | Must |

---

## 10. Security and Privacy

| ID | Requirement | Priority |
|----|-------------|----------|
| SP-01 | Photos are processed locally in browser/app; no remote image upload by default. | Must |
| SP-02 | Feedback endpoint only accepts private-network clients. | Must |
| SP-03 | Feedback endpoint enforces rate limiting and payload size limits. | Must |
| SP-04 | Optional feedback token protects LAN submissions when enabled. | Should |
| SP-05 | Issues created from feedback should omit raw IP/User-Agent data. | Must |

Data profile today:
- Collected locally for feedback endpoint: message text, device type, timestamp, UA, LAN IP.
- Stored in local feedback JSONL files.
- No authentication system for gameplay itself.
- No explicit GDPR/CCPA legal workflow documented yet.

---

## 11. Accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| ACC-01 | Core actions remain available via keyboard controls. | Must |
| ACC-02 | Mobile controls maintain large touch targets in native mode. | Must |
| ACC-03 | Critical game status (score/time/word progress) remains visually readable. | Should |
| ACC-04 | Reduce reliance on color-only debug meaning where feasible. | Should |
| ACC-05 | Establish WCAG 2.1 AA audit baseline for menus and overlays. | Could |

---

## 12. User Interface / Interaction Design

Current interaction model:
- Intro/splash + game screen structure for web.
- Native mode CSS overrides into fullscreen game layout with thumb-zone controls.
- HUD includes score/time/word status, detection mode badge, optional debug overlays.
- Pause and victory overlays implemented for native mode.

UI debt and remaining work:
- Base index layout still includes desktop-era inline styling patterns.
- Some control patterns differ between web and native modes and need consolidation.
- Documentation screenshots and guidance should be refreshed to match current shipped UX.

---

## 13. System States / Lifecycle

Primary states:
- Splash/intro
- Ready (photo selection)
- ML loading (if enabled)
- Level generation
- Active gameplay
- Paused
- Victory
- Error/fallback

Lifecycle considerations:
- App backgrounding in native mode triggers pause behavior.
- Back button interception exists for native shell handling.
- Regenerate and respawn transitions re-enter generation/play flow.

---

## 14. Implementation Phases

### Phase 1: Foundation and Modular Runtime (✅ Completed)
- [x] Split runtime into ES modules under js/*.
- [x] Centralize gameplay constants and tuning values.
- [x] Implement core platformer loop, collision, scoring, and goal flow.

### Phase 2: Detection and Reachability Safety (✅ Completed)
- [x] Implement grid detection + ML detection integration points.
- [x] Implement fallback module structure and composition logic.
- [x] Implement reachability/helper logic in gameplay flow.
- [x] Verify fallback algorithms are fully functional (Hough/edge-density/skeleton — confirmed implemented, not placeholders).
- [x] Implement segmentation-first contour extraction using YOLOv8n-seg as interim model (mask coefficients × prototype masks → sigmoid → instance masks → stepped block platforms). YOLOE-26n-seg will replace YOLOv8n-seg when available on a public CDN.

### Phase 3: Mobile and Native Packaging (✅ Completed)
- [x] Add Capacitor config and Android project integration.
- [x] Add native bridge wrappers and native-mode CSS.
- [x] Add pause/victory native overlays and thumb-zone controls.
- [x] Complete Android-specific UX polish (touch controls, haptics, overlays, immersive mode, safe area insets, rotate hint).
- [x] Complete device QA matrix (93/93 checks passed; 1 bug fixed: tab visibility pause).

### Phase 4: Hardening and Documentation Alignment (In Progress)
- [x] Upgrade and validate key dependencies: Express 4→5.2.1, ONNX Runtime Web 1.17→1.24.3, Capacitor 8.1→8.3.
- [x] Align docs defaults with runtime constants and current behavior (this task).
- [ ] Add stronger automated tests around detection/reachability invariants (in progress — Vitest test suite).
- [ ] Add production readiness checklist for release cadence.

---

## 15. Testing Strategy

| Level | Scope | Tools / Approach |
|-------|-------|------------------|
| Unit Tests | Utility logic and deterministic generation helpers | Add JS unit test framework (Vitest/Jest), start with detection/helpers |
| Integration Tests | Photo -> platform pipeline and reachability invariants | Headless browser tests plus deterministic fixtures |
| Manual / Exploratory | Gameplay feel, fairness, controls, scoring | Cross-device playtesting and photo-set regression checks |
| Performance | Inference times, FPS, memory pressure | Browser profiler + Android profiling sessions |
| Cross-Platform | Desktop browsers, mobile web, PWA, Android shell | Structured matrix with pass/fail checklist |

Key test scenarios:
1. ML disabled: level remains winnable and stable.
2. ML enabled with object-rich photo: ML platforms appear and are playable.
3. ML sparse photo: fallback chain produces traversable level.
4. Letter placement: every letter collectible reachable.
5. Goal placement: always reachable under selected candidate logic.
6. Native mode: pause/resume/back button/haptics function safely.
7. Offline replay after first load works with service worker cache.
8. Feedback endpoint rejects non-private IP requests and enforces limits.

---

## 16. Analytics / Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Playable level generation rate | >= 95% on curated photo set | Automated/manual regression set |
| Goal reachability pass rate | 100% before level start | Reachability validation logs |
| Letter reachability pass rate | 100% of placed letters | Placement validation + playtests |
| First-run ML readiness | <= 12s typical network | Measured from enable to ready state |
| Native control usability | >= 90% tester-rated acceptable | Structured user/device feedback |

Telemetry note:
- No production analytics SDK is currently integrated. Success is evaluated via manual playtesting, local feedback capture, and issue triage.

---

## 17. Acceptance Criteria

1. Players can generate and complete levels from representative indoor/outdoor photo sets.
2. If a platform looks jumpable, collision/physics confirm that expectation.
3. Goal and letter placements are always reachable under runtime checks.
4. Fallback paths prevent ML-sparse photos from becoming unwinnable.
5. Touch controls on mobile/native are usable without precision frustration.
6. PWA install and offline replay work after initial cache population.
7. Android package launches and supports core gameplay loop without critical regressions.
8. Documentation reflects the actual shipped defaults and supported modes.

---

## 18. Dependencies and Risks

### 18.1 Dependencies

| Dependency | Type | Risk if Unavailable | Mitigation |
|------------|------|---------------------|------------|
| ONNX Runtime Web CDN | runtime asset | ML mode unavailable or delayed | Keep local fallback path and cache strategy |
| YOLO ONNX model asset | model file | ML detection unavailable | Ship model locally and keep fallback chain robust |
| Capacitor plugins (camera/haptics/app/orientation) | native integration | Native UX degraded | Web-compatible no-op wrappers and graceful fallback |
| Express local server | utility backend | Feedback collection unavailable | Gameplay remains functional without feedback API |
| Service worker cache | browser capability | Offline behavior reduced | Network-first fallback and clear user messaging |

### 18.2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| ~~Placeholder fallback algorithms produce inconsistent quality~~ | ~~Medium~~ | ~~High~~ | ✅ Resolved — fallback algorithms verified complete and functional |
| Documentation drift from runtime constants | Medium | Medium | ✅ Being addressed — Phase 4 Task 4.3 aligns all docs with runtime |
| Dependency lag introduces security/compatibility debt | Low | Medium | ✅ Major deps upgraded (Express 5.2.1, ONNX 1.24.3, Capacitor 8.3); TypeScript upgrade remaining |
| Performance variance on low-end Android | Medium | High | Device profiling, tighter platform count/inference guardrails |
| ~~ML model mismatch with design intent (YOLOE vs YOLOv8 path)~~ | ~~High~~ | ~~High~~ | ✅ Mitigated — YOLOv8n-seg provides working segmentation pipeline; YOLOE migration deferred until model is CDN-available |

---

## 19. Future Considerations

| Item | Description | Potential Version |
|------|-------------|-------------------|
| ~~Segmentation-first ML pipeline completion~~ | ~~Full YOLOE mask-driven stepped contour generation~~ | ✅ Done (YOLOv8n-seg interim) |
| YOLOE-26n-seg model migration | Replace YOLOv8n-seg with YOLOE-26n-seg when available on public CDN | v1.1 |
| Web Worker inference path | Off-main-thread ML inference and post-processing | v1.2 |
| Expanded test automation | Deterministic photo fixtures + reachability assertions in CI | v1.2 |
| Optional telemetry with privacy controls | Aggregated performance/fairness metrics without raw photo data | v2 |
| iOS packaging parity | Capacitor iOS support and platform-specific QA | v2 |

---

## 20. Open Questions

| # | Question | Default Assumption |
|---|----------|--------------------|
| 1 | Should ML be enabled by default for all platforms now? | Keep disabled by default — fallback algorithms are complete, but ML adds load time; user opt-in is better UX |
| 2 | Should ML-only mode be the default in Android builds? | Keep Android override behavior but validate full photo-set reliability first |
| 3 | ~~Is YOLOE-26n-seg migration mandatory before next stable release?~~ | ✅ Resolved — YOLOv8n-seg provides working segmentation; YOLOE deferred until CDN-available |
| 4 | ~~Should Express 5 migration be in the next milestone?~~ | ✅ Resolved — Express 5.2.1 migration completed in Phase 4, Task 4.1 |
| 5 | What formal release quality bar is required (test matrix/pass %)? | Use manual matrix + acceptance criteria until automated suite lands (Vitest suite in progress) |

---

## 21. Glossary

| Term | Definition |
|------|------------|
| ML-Sparse Photo | A photo yielding too few ML-derived platforms for reliable traversal |
| Helper Platform | Additional generated platform inserted to restore playability |
| Reachability Validation | Logic that checks whether player can traverse to letters/goal |
| Segmentation Contour | Platform top outline derived from model mask output |
| ML-Only Mode | Generation mode that prefers ML platforms without grid contribution |
| Native Mode | Runtime with Capacitor shell behavior and android-game CSS overrides |

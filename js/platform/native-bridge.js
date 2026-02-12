/**
 * native-bridge.js — Capacitor plugin wrappers for Photo Jumper
 *
 * Provides a unified API that works on both web and native (Capacitor).
 * On web, functions gracefully degrade (no-op).
 *
 * In native mode, plugins are accessed via the Capacitor runtime which
 * registers them on window.Capacitor.Plugins — no external imports needed.
 */

// Detect Capacitor native environment
export const isNative = () =>
    typeof window !== 'undefined' &&
    window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform();

/**
 * Safely get a Capacitor plugin by name.
 * Returns null if not available (web mode or plugin not installed).
 */
function getPlugin(name) {
    try {
        if (!isNative()) return null;
        return window.Capacitor?.Plugins?.[name] || null;
    } catch {
        return null;
    }
}

// ── Haptics ─────────────────────────────────────────────────────────

/** Light haptic tap — for jump */
export async function hapticLight() {
    const haptics = getPlugin('Haptics');
    if (!haptics) return;
    try { await haptics.impact({ style: 'Light' }); } catch { /* not available */ }
}

/** Medium haptic tap — for letter collection */
export async function hapticMedium() {
    const haptics = getPlugin('Haptics');
    if (!haptics) return;
    try { await haptics.impact({ style: 'Medium' }); } catch { /* not available */ }
}

/** Success notification — for goal reached / win */
export async function hapticSuccess() {
    const haptics = getPlugin('Haptics');
    if (!haptics) return;
    try { await haptics.notification({ type: 'SUCCESS' }); } catch { /* not available */ }
}

// ── Status Bar ──────────────────────────────────────────────────────

/** Hide the system status bar for immersive gameplay */
export async function hideStatusBar() {
    const statusBar = getPlugin('StatusBar');
    if (!statusBar) return;
    try { await statusBar.hide(); } catch { /* not available */ }
}

/** Show the system status bar */
export async function showStatusBar() {
    const statusBar = getPlugin('StatusBar');
    if (!statusBar) return;
    try { await statusBar.show(); } catch { /* not available */ }
}

// ── Screen Orientation ──────────────────────────────────────────────

/** Lock to landscape (native only — web uses screen.orientation API) */
export async function lockLandscape() {
    const orientation = getPlugin('ScreenOrientation');
    if (!orientation) return;
    try { await orientation.lock({ orientation: 'landscape' }); } catch { /* not available */ }
}

// ── App Lifecycle ───────────────────────────────────────────────────

/**
 * Register a handler for Android back button.
 * @param {Function} handler — called when back is pressed
 */
export async function onBackButton(handler) {
    const app = getPlugin('App');
    if (!app) return;
    try {
        app.addListener('backButton', ({ canGoBack }) => {
            handler(canGoBack);
        });
    } catch { /* not available */ }
}

/**
 * Register handlers for app state changes (foreground/background).
 * @param {{ onPause: Function, onResume: Function }} handlers
 */
export async function onAppStateChange(handlers) {
    const app = getPlugin('App');
    if (!app) return;
    try {
        app.addListener('appStateChange', ({ isActive }) => {
            if (isActive && handlers.onResume) handlers.onResume();
            if (!isActive && handlers.onPause) handlers.onPause();
        });
    } catch { /* not available */ }
}

// ── Camera ──────────────────────────────────────────────────────────

/**
 * Take a photo using native camera (falls back to web file input).
 * @returns {Promise<string|null>} Data URL of the photo, or null if cancelled
 */
export async function takePhoto() {
    const camera = getPlugin('Camera');
    if (!camera) return null; // Let web use its own file input
    try {
        const photo = await camera.getPhoto({
            quality: 80,
            resultType: 'dataUrl',
            source: 'CAMERA',
            width: 1280,
            height: 960,
        });
        return photo.dataUrl || null;
    } catch {
        return null;
    }
}

/**
 * Choose a photo from gallery (falls back to web file input).
 * @returns {Promise<string|null>} Data URL of the photo, or null if cancelled
 */
export async function choosePhoto() {
    const camera = getPlugin('Camera');
    if (!camera) return null; // Let web use its own file input
    try {
        const photo = await camera.getPhoto({
            quality: 80,
            resultType: 'dataUrl',
            source: 'PHOTOS',
            width: 1280,
            height: 960,
        });
        return photo.dataUrl || null;
    } catch {
        return null;
    }
}

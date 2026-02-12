/**
 * native-bridge.js — Capacitor plugin wrappers for Photo Jumper
 *
 * Provides a unified API that works on both web and native (Capacitor).
 * On web, functions gracefully degrade or use web APIs as fallbacks.
 */

// Detect Capacitor native environment
export const isNative = () =>
    typeof window !== 'undefined' &&
    window.Capacitor &&
    window.Capacitor.isNativePlatform &&
    window.Capacitor.isNativePlatform();

// ── Haptics ─────────────────────────────────────────────────────────

let Haptics = null;
let ImpactStyle = null;
let NotificationType = null;

async function loadHaptics() {
    if (Haptics) return;
    if (!isNative()) return;
    try {
        const mod = await import('https://esm.sh/@capacitor/haptics');
        Haptics = mod.Haptics;
        ImpactStyle = mod.ImpactStyle;
        NotificationType = mod.NotificationType;
    } catch {
        // Haptics not available — silent fallback
    }
}

/** Light haptic tap — for jump */
export async function hapticLight() {
    await loadHaptics();
    if (!Haptics) return;
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch { /* noop */ }
}

/** Medium haptic tap — for letter collection */
export async function hapticMedium() {
    await loadHaptics();
    if (!Haptics) return;
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch { /* noop */ }
}

/** Success notification — for goal reached / win */
export async function hapticSuccess() {
    await loadHaptics();
    if (!Haptics) return;
    try { await Haptics.notification({ type: NotificationType.Success }); } catch { /* noop */ }
}

// ── Status Bar ──────────────────────────────────────────────────────

/** Hide the system status bar for immersive gameplay */
export async function hideStatusBar() {
    if (!isNative()) return;
    try {
        const { StatusBar } = await import('https://esm.sh/@capacitor/status-bar');
        await StatusBar.hide();
    } catch { /* noop */ }
}

/** Show the system status bar */
export async function showStatusBar() {
    if (!isNative()) return;
    try {
        const { StatusBar } = await import('https://esm.sh/@capacitor/status-bar');
        await StatusBar.show();
    } catch { /* noop */ }
}

// ── Screen Orientation ──────────────────────────────────────────────

/** Lock to landscape (native only — web uses screen.orientation API) */
export async function lockLandscape() {
    if (!isNative()) return;
    try {
        const { ScreenOrientation } = await import('https://esm.sh/@capacitor/screen-orientation');
        await ScreenOrientation.lock({ orientation: 'landscape' });
    } catch { /* noop */ }
}

// ── App Lifecycle ───────────────────────────────────────────────────

/**
 * Register a handler for Android back button.
 * @param {Function} handler — called when back is pressed; return true to prevent default
 */
export async function onBackButton(handler) {
    if (!isNative()) return;
    try {
        const { App } = await import('https://esm.sh/@capacitor/app');
        App.addListener('backButton', ({ canGoBack }) => {
            handler(canGoBack);
        });
    } catch { /* noop */ }
}

/**
 * Register handlers for app state changes (foreground/background).
 * @param {{ onPause: Function, onResume: Function }} handlers
 */
export async function onAppStateChange(handlers) {
    if (!isNative()) return;
    try {
        const { App } = await import('https://esm.sh/@capacitor/app');
        App.addListener('appStateChange', ({ isActive }) => {
            if (isActive && handlers.onResume) handlers.onResume();
            if (!isActive && handlers.onPause) handlers.onPause();
        });
    } catch { /* noop */ }
}

// ── Camera ──────────────────────────────────────────────────────────

/**
 * Take a photo using native camera (falls back to web file input).
 * @returns {Promise<string|null>} Data URL of the photo, or null if cancelled
 */
export async function takePhoto() {
    if (!isNative()) return null; // Let web use its own file input
    try {
        const { Camera, CameraResultType, CameraSource } = await import('https://esm.sh/@capacitor/camera');
        const photo = await Camera.getPhoto({
            quality: 80,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Camera,
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
    if (!isNative()) return null; // Let web use its own file input
    try {
        const { Camera, CameraResultType, CameraSource } = await import('https://esm.sh/@capacitor/camera');
        const photo = await Camera.getPhoto({
            quality: 80,
            resultType: CameraResultType.DataUrl,
            source: CameraSource.Photos,
            width: 1280,
            height: 960,
        });
        return photo.dataUrl || null;
    } catch {
        return null;
    }
}

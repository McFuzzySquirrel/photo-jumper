# Sideloading Photo Jumper onto a Real Android Device

This guide walks you through building and installing Photo Jumper directly onto an Android phone or tablet via USB — no Play Store required.

---

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| **Android device** | API 24 (Android 7.0) | API 30+ (Android 11+) |
| **Node.js** | 18+ | 20+ |
| **Java JDK** | 17 | 21 |
| **Android SDK** | Build Tools 34+ | Latest via Android Studio |
| **USB cable** | Data-capable USB cable | — |

> **Tip:** If you already have Android Studio installed, you likely have everything except Node.js.

---

## Step 1: Enable Developer Options on Your Device

1. Open **Settings → About Phone**
2. Tap **Build Number** 7 times until you see "You are now a developer!"
3. Go back to **Settings → Developer Options**
4. Enable **USB Debugging**
5. (Optional) Enable **Install via USB** if the option exists

---

## Step 2: Connect Your Device

1. Plug your device into your computer via USB
2. On the device, approve the "Allow USB debugging?" prompt
   - Check "Always allow from this computer" for convenience
3. Verify the connection:

```bash
adb devices
```

You should see your device listed:

```
List of devices attached
XXXXXXXX    device
```

> If you see `unauthorized`, re-check the prompt on your phone. If you see `offline`, try a different USB cable or port.

---

## Step 3: Build the APK

From the project root (`photo-jumper/`):

```bash
# 1. Sync web assets to the Android project
npm run cap:sync

# 2. Build the debug APK
cd android
./gradlew assembleDebug
```

The APK will be at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Build takes ~1-2 minutes on first run, ~5-15 seconds for incremental builds.

---

## Step 4: Install on Your Device

### Option A: Using Gradle (recommended)

```bash
# From the android/ directory, with device connected
./gradlew installDebug
```

This builds and installs in one step. The app appears in your app drawer as **Photo Jumper**.

### Option B: Using ADB directly

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Option C: Transfer the APK file

1. Copy `app-debug.apk` to your device (via USB file transfer, email, cloud storage, etc.)
2. Open the APK file on your device
3. Allow "Install from unknown sources" when prompted
4. Tap **Install**

---

## Step 5: Launch and Play

### From command line:

```bash
adb shell am start -n com.photojumper.game/.MainActivity
```

### From the device:

Open your app drawer and tap **Photo Jumper**.

---

## Troubleshooting

### "No devices found"

```bash
# Restart ADB server
adb kill-server && adb start-server
adb devices
```

If still not showing, check:
- USB cable supports data transfer (not charge-only)
- USB debugging is enabled
- You approved the debugging prompt on the device

### "INSTALL_FAILED_UPDATE_INCOMPATIBLE"

A previous install with a different signing key exists:

```bash
adb uninstall com.photojumper.game
./gradlew installDebug
```

### "INSTALL_FAILED_OLDER_SDK"

Your device's Android version is below API 24 (Android 7.0). Photo Jumper requires Android 7.0+.

### App crashes on launch

Check logs for errors:

```bash
adb logcat | grep -E "Capacitor|photojumper" --line-buffered
```

### ML detection not working

The ONNX model (`models/yolov8n.onnx`) is bundled with the app. If detection fails:
- Check device has enough RAM (≥2GB recommended)
- The model loads via WASM backend — some very old devices may not support it
- Check logcat for model loading errors:

```bash
adb logcat | grep "Capacitor/Console" | grep -i "model\|onnx"
```

---

## Building a Release APK (Optional)

Debug APKs work fine for personal use. For a smaller, optimized build:

### 1. Create a signing key (one-time)

```bash
keytool -genkey -v -keystore photo-jumper-release.keystore \
  -alias photo-jumper -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configure signing in `android/app/build.gradle`

Add inside `android { }`:

```groovy
signingConfigs {
    release {
        storeFile file('photo-jumper-release.keystore')
        storePassword 'your-store-password'
        keyAlias 'photo-jumper'
        keyPassword 'your-key-password'
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

> ⚠️ **Never commit your keystore or passwords to Git.** Use environment variables or a local properties file.

### 3. Build the release APK

```bash
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

The release APK is smaller and slightly faster than debug.

---

## Quick Reference

| Action | Command |
|---|---|
| Sync web → Android | `npm run cap:sync` |
| Build debug APK | `cd android && ./gradlew assembleDebug` |
| Build + install | `cd android && ./gradlew installDebug` |
| Launch app | `adb shell am start -n com.photojumper.game/.MainActivity` |
| View logs | `adb logcat \| grep "Capacitor/Console"` |
| Uninstall | `adb uninstall com.photojumper.game` |
| Force stop | `adb shell am force-stop com.photojumper.game` |

---

## App Details

| Property | Value |
|---|---|
| Package ID | `com.photojumper.game` |
| App Name | Photo Jumper |
| Min Android | 7.0 (API 24) |
| Target Android | 16 (API 36) |
| Version | 1.0.0 |
| Web Runtime | Capacitor 7.x |
| ML Model | YOLOv8n (bundled, ~13MB) |

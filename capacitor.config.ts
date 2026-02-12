import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.photojumper.game',
  appName: 'Photo Jumper',
  webDir: 'www',
  android: {
    // Hardware-accelerated WebView for Canvas game performance
    allowMixedContent: true,
    backgroundColor: '#1a1a2e',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: '#667eea',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1a1a2e',
    },
    ScreenOrientation: {
      // Locked to landscape in AndroidManifest; plugin provides JS API
    },
  },
  server: {
    // During development, uncomment to load from live server:
    // url: 'http://10.0.2.2:8080',
    // cleartext: true,
    androidScheme: 'https',
  },
};

export default config;

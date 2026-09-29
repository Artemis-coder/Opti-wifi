import type { CapacitorConfig } from '@capacitor/cli'

const serverUrl = process.env.CAP_SERVER_URL ?? 'https://opti-wifi.vercel.app'

const config: CapacitorConfig = {
  appId: 'com.optiwifi.app',
  appName: 'Opti Wi-Fi',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#0b1a3aff',
    // Android 15 (targetSdk 35) forces edge-to-edge: the WebView would draw
    // under the status bar and the system navigation bar, hiding the phone
    // taskbar. 'force' gives the WebView margins for the system bars so the
    // app content is laid out inside them.
    adjustMarginsForEdgeToEdge: 'force',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0b1a3aff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0b1a3a',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'BODY',
      resizeOnFullScreen: true,
    },
  },
}

export default config

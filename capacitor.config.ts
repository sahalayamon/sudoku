import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native shell for the static export in ./out.
 * All app code and assets are bundled into the APK, so the game needs no network at all.
 */
const config: CapacitorConfig = {
  appId: "app.sudoku.play",
  appName: "Sudoku",
  webDir: "out",
  // Matches the default (Sage, light) page colour so there is no white flash before the web view paints.
  backgroundColor: "#eef0e8",
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // The app hides the splash itself once local data is loaded (see NativeBridge).
      launchAutoHide: false,
      backgroundColor: "#eef0e8",
      androidScaleType: "CENTER_INSIDE",
      showSpinner: false,
    },
  },
};

export default config;

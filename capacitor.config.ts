import type { CapacitorConfig } from "@capacitor/cli";

const TESTFLIGHT_PREVIEW_SERVER_URL =
  "https://member-ui-b10---cloud-core-studio-6uthbm2yyq-zf.a.run.app";

const config: CapacitorConfig = {
  appId: "com.cloudandcore.studio",
  appName: "Cloud & Core",
  webDir: "native-fallback",
  bundledWebRuntime: false,
  appendUserAgent: "CloudCoreNative/1",
  server: {
    url: TESTFLIGHT_PREVIEW_SERVER_URL,
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#FAF7F2",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#FAF7F2",
    },
    Keyboard: {
      resize: "body",
      style: "light",
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert", "banner", "list"],
    },
  },
};

export default config;

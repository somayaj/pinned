/** @type {import('expo/config').ExpoConfig} */
// Default OAuth client IDs (Google Cloud). Override with EXPO_PUBLIC_* in .env if needed.
const GOOGLE_WEB =
  "559395124998-80nodpvoat8ifi2f1qm9qc2f2cdngd22.apps.googleusercontent.com";
const GOOGLE_IOS =
  "559395124998-j0k515p1mjrrhkljm18te9k7ui8htc40.apps.googleusercontent.com";
const GOOGLE_ANDROID =
  "559395124998-1s4vnrk1jcp3ii42o669udllcfa1iqt4.apps.googleusercontent.com";

module.exports = {
  name: "Pinned",
  slug: "pinned",
  description: "Dropping a pin sets a reminder at a location.",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  scheme: "pinned",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "app.pinned.mobile",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Pinned uses your location to remind you when you arrive at a saved pin.",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    package: "app.pinned.mobile",
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "POST_NOTIFICATIONS",
    ],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL ??
      "https://pinned-production-b992.up.railway.app",
    googleWebClientId:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? GOOGLE_WEB,
    googleIosClientId:
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? GOOGLE_IOS,
    googleAndroidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? GOOGLE_ANDROID,
  },
  plugins: [
    "@react-native-community/datetimepicker",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Pinned uses your location to remind you when you reach a saved pin.",
        locationWhenInUsePermission:
          "Pinned uses your location to remind you when you reach a saved pin.",
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    "expo-notifications",
  ],
};

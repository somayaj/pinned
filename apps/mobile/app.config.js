/** @type {import('expo/config').ExpoConfig} */
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
    googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  },
  plugins: [
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

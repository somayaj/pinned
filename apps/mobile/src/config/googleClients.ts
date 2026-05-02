import Constants from "expo-constants";

/**
 * Defaults must stay in sync with apps/mobile/app.config.js.
 *
 * On web, expo-constants often exposes an empty manifest (no APP_MANIFEST), so
 * `Constants.expoConfig?.extra` is missing and OAuth would open without client_id.
 * Env vars and these fallbacks keep sign-in working everywhere.
 */
const DEFAULT_GOOGLE_WEB =
  "559395124998-80nodpvoat8ifi2f1qm9qc2f2cdngd22.apps.googleusercontent.com";
const DEFAULT_GOOGLE_IOS =
  "559395124998-j0k515p1mjrrhkljm18te9k7ui8htc40.apps.googleusercontent.com";
const DEFAULT_GOOGLE_ANDROID =
  "559395124998-1s4vnrk1jcp3ii42o669udllcfa1iqt4.apps.googleusercontent.com";

type Extra = {
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
};

function firstNonEmpty(
  ...candidates: (string | undefined)[]
): string | undefined {
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return undefined;
}

export function getGoogleClientIds() {
  const extra = Constants.expoConfig?.extra as Extra | undefined;

  return {
    webClientId:
      firstNonEmpty(
        extra?.googleWebClientId,
        process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      ) ?? DEFAULT_GOOGLE_WEB,
    iosClientId: firstNonEmpty(
      extra?.googleIosClientId,
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      DEFAULT_GOOGLE_IOS,
    ),
    androidClientId: firstNonEmpty(
      extra?.googleAndroidClientId,
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      DEFAULT_GOOGLE_ANDROID,
    ),
  };
}

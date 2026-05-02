/**
 * Imported first from `index.ts` so this runs before `App` (and AuthSession) loads.
 * OAuth popup: completes the session and posts the redirect URL to the opener.
 */
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

if (Platform.OS === "web") {
  if (typeof document !== "undefined") {
    document.title = "PinIt";
  }
  try {
    WebBrowser.maybeCompleteAuthSession({
      skipRedirectCheck: __DEV__,
    });
  } catch {
    /* Main window — normal. */
  }
}

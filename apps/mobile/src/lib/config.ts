import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const STORAGE_KEY = "pinned_api_base_url";

/** Same default as apps/mobile/app.config.js — used when manifest.extra is missing (common on web). */
const FALLBACK_API_BASE = "https://pinned-production-b992.up.railway.app";

function firstNonEmpty(
  ...candidates: (string | undefined)[]
): string | undefined {
  for (const c of candidates) {
    const t = c?.trim();
    if (t) return t;
  }
  return undefined;
}

export const DEFAULT_API_BASE =
  firstNonEmpty(
    Constants.expoConfig?.extra?.apiUrl as string | undefined,
    process.env.EXPO_PUBLIC_API_URL,
  ) ?? FALLBACK_API_BASE;

const DEFAULT_API = DEFAULT_API_BASE;

/** Ports used by Metro / Expo dev — never the pinned-api server. */
const EXPO_DEV_PORTS = new Set([
  8081, 8082, 8097, 19000, 19001, 19002, 19006, 19007,
]);

function isLikelyExpoBundlerUrl(url: string): boolean {
  try {
    const withProto = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase();
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
      return false;
    }
    const port = u.port ? parseInt(u.port, 10) : 80;
    return EXPO_DEV_PORTS.has(port);
  } catch {
    return false;
  }
}

/**
 * If the API base is empty, invalid, or the same origin as the web app, `fetch(\`\${base}/auth/google\`)`
 * becomes a relative URL and hits the Expo server → "Cannot POST /auth/google".
 */
function coerceApiBase(url: string): string {
  let u = normalizeBaseUrl(url);
  if (!u || u === "https://" || u === "http://") {
    return normalizeBaseUrl(FALLBACK_API_BASE);
  }
  try {
    const parsed = new URL(u);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      if (parsed.origin === window.location.origin) {
        return normalizeBaseUrl(FALLBACK_API_BASE);
      }
    }
  } catch {
    return normalizeBaseUrl(FALLBACK_API_BASE);
  }
  return u;
}

export async function getApiBaseUrl(): Promise<string> {
  let resolved: string;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) {
      const normalized = normalizeBaseUrl(stored.trim());
      if (isLikelyExpoBundlerUrl(normalized)) {
        await AsyncStorage.removeItem(STORAGE_KEY);
        resolved = normalizeBaseUrl(DEFAULT_API);
      } else {
        resolved = normalized;
      }
    } else {
      resolved = normalizeBaseUrl(DEFAULT_API);
    }
  } catch {
    resolved = normalizeBaseUrl(DEFAULT_API);
  }
  return coerceApiBase(resolved);
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const normalized = normalizeBaseUrl(url.trim());
  await AsyncStorage.setItem(STORAGE_KEY, normalized);
}

export function normalizeBaseUrl(url: string): string {
  let u = url.replace(/\/$/, "");
  if (!/^https?:\/\//i.test(u)) {
    u = `https://${u}`;
  }
  return u.replace(/\/$/, "");
}

export function toWebSocketUrl(httpBase: string, accessToken: string): string {
  const u = new URL(httpBase.includes("://") ? httpBase : `https://${httpBase}`);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/ws";
  u.searchParams.set("token", accessToken);
  u.hash = "";
  return u.toString();
}

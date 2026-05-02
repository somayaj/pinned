import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const STORAGE_KEY = "pinned_api_base_url";

export const DEFAULT_API_BASE =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "https://pinned-production-b992.up.railway.app";

const DEFAULT_API = DEFAULT_API_BASE;

export async function getApiBaseUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) {
      return normalizeBaseUrl(stored.trim());
    }
  } catch {
    /* use default */
  }
  return normalizeBaseUrl(DEFAULT_API);
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

import type { Location } from "../types/location";
import type { Task } from "../types/task";

function authHeaders(accessToken: string, json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

/**
 * Optional filters for `GET /tasks` (map pins only; time-only tasks are excluded when any filter is used).
 * - **center** — pin centers within `centerRadiusMeters` of `(centerLat, centerLon)` (default radius 100 m).
 * - **contains** — pins whose geofence contains `(containsLat, containsLon)`.
 * Both can be combined (AND).
 */
export type FetchTasksLocationParams = {
  /** Only tasks created for this saved location. */
  locationId?: string;
  centerLat?: number;
  centerLon?: number;
  centerRadiusMeters?: number;
  containsLat?: number;
  containsLon?: number;
};

function tasksUrl(
  apiBase: string,
  location?: FetchTasksLocationParams
): string {
  const base = `${apiBase.replace(/\/$/, "")}/tasks`;
  if (!location) return base;
  const p = new URLSearchParams();
  if (location.locationId != null)
    p.set("locationId", location.locationId);
  if (location.centerLat != null)
    p.set("centerLat", String(location.centerLat));
  if (location.centerLon != null)
    p.set("centerLon", String(location.centerLon));
  if (location.centerRadiusMeters != null)
    p.set("centerRadiusMeters", String(location.centerRadiusMeters));
  if (location.containsLat != null)
    p.set("containsLat", String(location.containsLat));
  if (location.containsLon != null)
    p.set("containsLon", String(location.containsLon));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function fetchTasks(
  apiBase: string,
  accessToken: string,
  location?: FetchTasksLocationParams
): Promise<Task[]> {
  const res = await fetch(tasksUrl(apiBase, location), {
    headers: authHeaders(accessToken),
  });
  if (res.status === 401) {
    throw new Error("session_expired");
  }
  if (!res.ok) {
    throw new Error(`Tasks failed: ${res.status}`);
  }
  const data = (await res.json()) as { tasks: Task[] };
  return data.tasks;
}

export async function fetchLocations(
  apiBase: string,
  accessToken: string
): Promise<Location[]> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/locations`, {
    headers: authHeaders(accessToken),
  });
  if (res.status === 401) throw new Error("session_expired");
  if (!res.ok) throw new Error(`Locations failed: ${res.status}`);
  const data = (await res.json()) as { locations: Location[] };
  return data.locations;
}

export async function createLocation(
  apiBase: string,
  accessToken: string,
  body: {
    name: string;
    description?: string | null;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }
): Promise<Location> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/locations`, {
    method: "POST",
    headers: authHeaders(accessToken, true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Create location failed: ${res.status}`);
  }
  const data = (await res.json()) as { location: Location };
  return data.location;
}

export async function deleteLocation(
  apiBase: string,
  accessToken: string,
  id: string
): Promise<void> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/locations/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete location failed: ${res.status}`);
  }
}

export async function createTask(
  apiBase: string,
  accessToken: string,
  body: {
    title: string;
    description?: string | null;
    locationId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
    remindAt: string | null;
  }
): Promise<Task> {
  const res = await fetch(`${apiBase}/tasks`, {
    method: "POST",
    headers: authHeaders(accessToken, true),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Create failed: ${res.status}`);
  }
  const data = (await res.json()) as { task: Task };
  return data.task;
}

export async function deleteTask(
  apiBase: string,
  accessToken: string,
  id: string
): Promise<void> {
  const res = await fetch(`${apiBase}/tasks/${id}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Delete failed: ${res.status}`);
  }
}

/** Deletes all reminders for the current user. Saved places are kept. */
export async function deleteAllTasks(
  apiBase: string,
  accessToken: string
): Promise<Task[]> {
  const base = apiBase.replace(/\/$/, "");
  const res = await fetch(`${base}/tasks`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
  if (res.status === 401) {
    throw new Error("session_expired");
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Delete all failed: ${res.status}`);
  }
  const data = (await res.json()) as { tasks: Task[] };
  return data.tasks;
}

export type WebPushTestResult = {
  vapidConfigured: boolean;
  subscriptions: number;
  sent: number;
  failed: number;
};

/** Web only — verify VAPID + subscription without entering a geofence. */
export async function postWebPushTest(
  apiBase: string,
  accessToken: string
): Promise<WebPushTestResult> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/push/test`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  if (res.status === 401) {
    throw new Error("session_expired");
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Test push failed: ${res.status}`);
  }
  return res.json() as Promise<WebPushTestResult>;
}

export async function nudgeTask(
  apiBase: string,
  accessToken: string,
  id: string
): Promise<void> {
  const res = await fetch(`${apiBase}/tasks/${id}/nudge`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    throw new Error(`Nudge failed: ${res.status}`);
  }
}

export type UserProfile = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  phoneE164: string | null;
  smsAlerts: boolean;
};

export type StockQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  shortName: string | null;
};

export type StockWatchlistResponse = {
  symbols: string[];
  pollIntervalMinutes: number;
};

export async function fetchStockWatchlist(
  apiBase: string,
  accessToken: string
): Promise<StockWatchlistResponse> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/stocks/watchlist`, {
    headers: authHeaders(accessToken),
  });
  if (res.status === 401) throw new Error("session_expired");
  if (!res.ok) throw new Error(`Stocks watchlist failed: ${res.status}`);
  return res.json() as Promise<StockWatchlistResponse>;
}

export async function putStockWatchlist(
  apiBase: string,
  accessToken: string,
  body: { symbols: string[]; pollIntervalMinutes?: number }
): Promise<StockWatchlistResponse> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/stocks/watchlist`, {
    method: "PUT",
    headers: authHeaders(accessToken, true),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("session_expired");
  if (!res.ok) {
    const t = await res.text();
    let msg = t || `Stocks save failed: ${res.status}`;
    try {
      const j = JSON.parse(t) as { error?: unknown };
      if (typeof j.error === "string") msg = j.error;
    } catch {
      /* keep msg */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<StockWatchlistResponse>;
}

export async function fetchStockQuotes(
  apiBase: string,
  accessToken: string,
  symbols: string[]
): Promise<{ quotes: StockQuote[]; fetchedAt: string }> {
  if (symbols.length === 0) {
    return { quotes: [], fetchedAt: new Date().toISOString() };
  }
  const q = encodeURIComponent(symbols.join(","));
  const res = await fetch(
    `${apiBase.replace(/\/$/, "")}/stocks/quotes?symbols=${q}`,
    { headers: authHeaders(accessToken) }
  );
  if (res.status === 401) throw new Error("session_expired");
  if (!res.ok) throw new Error(`Stock quotes failed: ${res.status}`);
  return res.json() as Promise<{ quotes: StockQuote[]; fetchedAt: string }>;
}

export async function fetchUserProfile(
  apiBase: string,
  accessToken: string
): Promise<UserProfile> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/auth/profile`, {
    headers: authHeaders(accessToken),
  });
  if (res.status === 401) throw new Error("session_expired");
  if (!res.ok) throw new Error(`Profile failed: ${res.status}`);
  const data = (await res.json()) as { user: UserProfile };
  return data.user;
}

export async function patchUserProfile(
  apiBase: string,
  accessToken: string,
  body: { phoneE164?: string | null; smsAlerts?: boolean }
): Promise<UserProfile> {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/auth/profile`, {
    method: "PATCH",
    headers: authHeaders(accessToken, true),
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Error("session_expired");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `Profile update failed: ${res.status}`);
  }
  const data = (await res.json()) as { user: UserProfile };
  return data.user;
}

export async function exchangeGoogleIdToken(
  apiBase: string,
  idToken: string
): Promise<{
  token: string;
  user: { id: string; email: string | null; name: string | null; picture: string | null };
}> {
  const base = apiBase.replace(/\/$/, "");
  let authUrl: string;
  try {
    authUrl = new URL("/auth/google", `${base}/`).href;
  } catch {
    throw new Error(
      "Invalid API base URL. Use Settings → API base URL with a full URL like https://pinned-production-b992.up.railway.app",
    );
  }

  const res = await fetch(authUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (/Cannot POST\s+\/auth\/google/i.test(t)) {
      throw new Error(
        "Sign-in hit the wrong server (often the Expo UI port). Open Settings and set API base URL to your pinned-api host, e.g. https://pinned-production-b992.up.railway.app — not http://localhost:8081.",
      );
    }
    if (t.includes("<!DOCTYPE") || t.includes("<html")) {
      throw new Error(`Sign-in failed (${res.status}). Check API base URL in Settings points to pinned-api, not the Expo dev server.`);
    }
    throw new Error(t.length > 280 ? `Sign-in failed (${res.status})` : t || "Sign-in failed");
  }
  return res.json() as Promise<{
    token: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
      picture: string | null;
    };
  }>;
}

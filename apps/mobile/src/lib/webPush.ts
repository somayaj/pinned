import { getApiBaseUrl } from "./config";

/** Decode VAPID public key from server (URL-safe base64). */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = globalThis.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function fetchVapidPublic(base: string): Promise<string | null> {
  const res = await fetch(`${base}/push/vapid-public`);
  if (res.status === 503) return null;
  if (!res.ok) return null;
  const j = (await res.json()) as { publicKey?: string };
  return j.publicKey?.trim() ?? null;
}

/**
 * Register SW, subscribe with VAPID, POST /push/subscribe. Web only.
 */
export async function subscribeToWebPush(
  accessToken: string
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false, error: "unsupported" };
  }
  const base = (await getApiBaseUrl()).replace(/\/$/, "");
  const publicKey = await fetchVapidPublic(base);
  if (!publicKey) {
    return { ok: false, error: "no_server_keys" };
  }

  const reg = await navigator.serviceWorker.register("/service-worker.js", {
    scope: "/",
  });
  await reg.update();

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, error: "denied" };
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey:
      applicationServerKey as unknown as BufferSource,
  });

  const res = await fetch(`${base}/push/subscribe`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sub.toJSON()),
  });

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }
  return { ok: true };
}

export async function unsubscribeFromWebPush(
  accessToken: string
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
  const base = (await getApiBaseUrl()).replace(/\/$/, "");
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  await fetch(`${base}/push/subscribe`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sub ? { endpoint: sub.endpoint } : {}),
  });
  if (sub) await sub.unsubscribe();
}

export async function hasWebPushSubscription(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker) {
    return false;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub != null;
  } catch {
    return false;
  }
}

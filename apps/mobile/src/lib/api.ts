import type { Task } from "../types/task";

function authHeaders(accessToken: string, json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export async function fetchTasks(
  apiBase: string,
  accessToken: string
): Promise<Task[]> {
  const res = await fetch(`${apiBase}/tasks`, {
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

export async function createTask(
  apiBase: string,
  accessToken: string,
  body: {
    title: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
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

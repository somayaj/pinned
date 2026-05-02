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
  const res = await fetch(`${apiBase}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || "Sign-in failed");
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

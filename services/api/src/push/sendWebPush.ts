import webpush from "web-push";
import type { Task } from "../types.js";
import * as store from "../store.js";

let configured = false;

function ensureVapid(): boolean {
  if (configured) return true;
  const pub = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const priv = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = (
    process.env.WEB_PUSH_SUBJECT ?? "mailto:push@localhost"
  ).trim();
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

/** Called when user enters a pin zone — also notifies subscribed browsers (tab may be closed). */
export async function sendWebPushZoneEntry(
  userId: string,
  task: Task
): Promise<void> {
  if (!ensureVapid()) return;
  const subs = await store.listWebPushSubscriptions(userId);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: "Pinned",
    body: `You're at: ${task.title}`,
    taskId: task.id,
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 86_400 }
      );
    } catch (err: unknown) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 410 || code === 404) {
        await store.deleteWebPushSubscriptionByEndpoint(sub.endpoint);
      }
    }
  }
}

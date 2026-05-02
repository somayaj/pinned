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
  if (!pub || !priv) {
    console.warn(
      "[web-push] WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY not set — push disabled"
    );
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

function logWebPushError(endpoint: string, err: unknown): void {
  const e = err as {
    statusCode?: number;
    message?: string;
    body?: string;
    endpoint?: string;
  };
  console.error(
    "[web-push] send failed",
    e.statusCode ?? "?",
    e.message,
    e.body ?? "",
    endpoint.slice(0, 48) + "…"
  );
}

async function sendPayloadToAllSubscriptions(
  userId: string,
  payload: string
): Promise<{ sent: number; failed: number; subscriptionCount: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0, subscriptionCount: 0 };
  const subs = await store.listWebPushSubscriptions(userId);
  if (subs.length === 0) return { sent: 0, failed: 0, subscriptionCount: 0 };

  let sent = 0;
  let failed = 0;
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
      sent++;
    } catch (err: unknown) {
      failed++;
      logWebPushError(sub.endpoint, err);
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 410 || code === 404) {
        await store.deleteWebPushSubscriptionByEndpoint(sub.endpoint);
      }
    }
  }
  return { sent, failed, subscriptionCount: subs.length };
}

/** Called when user enters a pin zone — also notifies subscribed browsers (tab may be closed). */
export async function sendWebPushZoneEntry(
  userId: string,
  task: Task
): Promise<void> {
  const atPlace =
    task.latitude != null && task.longitude != null && task.radiusMeters != null;
  const payload = JSON.stringify({
    title: "Pinned",
    body: atPlace
      ? `You're at: ${task.title}`
      : `Reminder: ${task.title}`,
    taskId: task.id,
  });
  const { sent, failed, subscriptionCount } = await sendPayloadToAllSubscriptions(
    userId,
    payload
  );
  if (subscriptionCount > 0) {
    console.log(
      `[web-push] zone_entry task=${task.title} sent=${sent} failed=${failed} subs=${subscriptionCount}`
    );
  }
}

/** Authenticated test — does not require being in a geofence. */
export async function sendWebPushTest(userId: string): Promise<{
  vapidConfigured: boolean;
  subscriptions: number;
  sent: number;
  failed: number;
}> {
  if (!ensureVapid()) {
    return {
      vapidConfigured: false,
      subscriptions: 0,
      sent: 0,
      failed: 0,
    };
  }
  const payload = JSON.stringify({
    title: "Pinned",
    body: "Test push — Web Push is working.",
    taskId: null,
  });
  const { sent, failed, subscriptionCount } = await sendPayloadToAllSubscriptions(
    userId,
    payload
  );
  return {
    vapidConfigured: true,
    subscriptions: subscriptionCount,
    sent,
    failed,
  };
}

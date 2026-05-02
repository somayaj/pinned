import type { Request, Response } from "express";
import { z } from "zod";
import * as store from "../store.js";

const subscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export function getVapidPublic(_req: Request, res: Response): void {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  if (!publicKey) {
    res.status(503).json({ error: "web_push_not_configured" });
    return;
  }
  res.json({ publicKey });
}

export async function postPushSubscription(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const parsed = subscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    await store.upsertWebPushSubscription(userId, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
}

const deleteBody = z.object({
  endpoint: z.string().url().optional(),
});

export async function deletePushSubscription(
  req: Request,
  res: Response
): Promise<void> {
  const userId = req.userId!;
  const parsed = deleteBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    if (parsed.data.endpoint) {
      const rows = await store.listWebPushSubscriptions(userId);
      const match = rows.find((r) => r.endpoint === parsed.data.endpoint);
      if (match) {
        await store.deleteWebPushSubscriptionByEndpoint(parsed.data.endpoint);
      }
    } else {
      await store.deleteAllWebPushSubscriptionsForUser(userId);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
}

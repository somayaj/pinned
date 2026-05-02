import { Router } from "express";
import { z } from "zod";
import { verifyGoogleIdToken } from "../auth/googleVerify.js";
import { signSessionToken } from "../auth/jwt.js";
import { requireAuth } from "../middleware/requireAuth.js";
import * as store from "../store.js";

export const authRouter = Router();

const patchProfileBody = z.object({
  phoneE164: z.string().nullable().optional(),
  smsAlerts: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
  reminderMutedTaskIds: z.array(z.string().min(1).max(40)).max(100).optional(),
  stocksUpdatesEnabled: z.boolean().optional(),
});

const googleBody = z.object({
  idToken: z.string().min(20),
});

authRouter.post("/google", async (req, res) => {
  const parsed = googleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const profile = await verifyGoogleIdToken(parsed.data.idToken);
    const user = await store.findOrCreateUserFromGoogle(profile);
    const token = signSessionToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "google_auth_failed" });
  }
});

authRouter.get("/profile", requireAuth, async (req, res) => {
  const userId = req.userId!;
  try {
    const user = await store.getUserProfile(userId);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        phoneE164: user.phoneE164,
        smsAlerts: user.smsAlerts,
        remindersEnabled: user.remindersEnabled,
        reminderMutedTaskIds: user.reminderMutedTaskIds,
        stocksUpdatesEnabled: user.stocksUpdatesEnabled,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "profile_failed" });
  }
});

authRouter.patch("/profile", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const parsed = patchProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const {
    phoneE164,
    smsAlerts,
    remindersEnabled,
    reminderMutedTaskIds,
    stocksUpdatesEnabled,
  } = parsed.data;
  if (
    smsAlerts === undefined &&
    phoneE164 === undefined &&
    remindersEnabled === undefined &&
    reminderMutedTaskIds === undefined &&
    stocksUpdatesEnabled === undefined
  ) {
    res.status(400).json({ error: "no_fields" });
    return;
  }
  try {
    const current = await store.getUserProfile(userId);
    await store.updateUserProfile(userId, {
      phoneE164:
        phoneE164 !== undefined ? phoneE164 : current.phoneE164,
      smsAlerts:
        smsAlerts !== undefined ? smsAlerts : current.smsAlerts,
      remindersEnabled:
        remindersEnabled !== undefined
          ? remindersEnabled
          : current.remindersEnabled,
      reminderMutedTaskIds:
        reminderMutedTaskIds !== undefined
          ? reminderMutedTaskIds
          : current.reminderMutedTaskIds,
      stocksUpdatesEnabled:
        stocksUpdatesEnabled !== undefined
          ? stocksUpdatesEnabled
          : current.stocksUpdatesEnabled,
    });
    const user = await store.getUserProfile(userId);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        phoneE164: user.phoneE164,
        smsAlerts: user.smsAlerts,
        remindersEnabled: user.remindersEnabled,
        reminderMutedTaskIds: user.reminderMutedTaskIds,
        stocksUpdatesEnabled: user.stocksUpdatesEnabled,
      },
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "invalid_phone_e164") {
        res.status(400).json({ error: "invalid_phone_e164" });
        return;
      }
    }
    console.error(e);
    res.status(500).json({ error: "profile_update_failed" });
  }
});

import { Router } from "express";
import { z } from "zod";
import { verifyGoogleIdToken } from "../auth/googleVerify.js";
import { signSessionToken } from "../auth/jwt.js";
import * as store from "../store.js";

export const authRouter = Router();

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

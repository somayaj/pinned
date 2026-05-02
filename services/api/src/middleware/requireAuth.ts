import type { RequestHandler } from "express";
import { verifySessionToken } from "../auth/jwt.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }
  try {
    const { sub } = verifySessionToken(token);
    req.userId = sub;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
};

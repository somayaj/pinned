import type { Request, Response } from "express";

/** Nominatim usage policy: identify the app. */
const NOMINATIM_UA = "PinIt/1.0 (https://github.com/somayaj/pinned)";

/**
 * Public GET /geocode?q=... — server-side forward to Nominatim so the web app
 * avoids browser CORS (direct Nominatim fetch from localhost often fails).
 */
export async function geocodeHandler(req: Request, res: Response): Promise<void> {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.status(400).json({ error: "missing_q" });
    return;
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
    if (!r.ok) {
      res.status(502).json({ error: "geocode_upstream" });
      return;
    }
    const data = (await r.json()) as { lat: string; lon: string }[];
    if (!data?.length) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const latitude = Number.parseFloat(data[0].lat);
    const longitude = Number.parseFloat(data[0].lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ latitude, longitude });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "geocode_failed" });
  }
}

import { Router } from "express";
import RSSParser from "rss-parser";
import { z } from "zod";
import * as store from "../store.js";

export const newsRouter = Router();

const putNewsSettingsBody = z.object({
  pollIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((n) => [0, 1, 3, 5, 10, 15, 30].includes(n), {
      message: "invalid_poll_interval",
    }),
});

const parser = new RSSParser({
  timeout: 12_000,
  headers: {
    "User-Agent":
      "pinned-api/1.0 (+https://github.com/somayaj/pinned; news headlines)",
  },
});

const CNN_RSS = "https://rss.cnn.com/rss/cnn_topstories.rss";
const CNBC_RSS = "https://www.cnbc.com/id/100003114/device/rss/rss.html";

export type NewsHeadline = {
  title: string;
  link: string;
  pubDate: string | null;
};

newsRouter.get("/settings", async (req, res) => {
  const userId = req.userId!;
  try {
    const row = await store.getNewsSettings(userId);
    res.json({
      pollIntervalMinutes: row?.pollIntervalMinutes ?? 5,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "database_error" });
  }
});

newsRouter.put("/settings", async (req, res) => {
  const userId = req.userId!;
  const parsed = putNewsSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  const { pollIntervalMinutes } = parsed.data;
  try {
    await store.setNewsSettings(userId, pollIntervalMinutes);
    res.json({ pollIntervalMinutes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "database_error" });
  }
});

async function takeHeadlines(url: string, limit: number): Promise<NewsHeadline[]> {
  const feed = await parser.parseURL(url);
  const items = feed.items ?? [];
  return items.slice(0, limit).map((item) => ({
    title: (item.title ?? "").trim() || "Untitled",
    link: (item.link ?? "").trim() || "#",
    pubDate: item.pubDate ?? item.isoDate ?? null,
  }));
}

newsRouter.get("/headlines", async (_req, res) => {
  const fetchedAt = new Date().toISOString();
  const cnn: NewsHeadline[] = [];
  const cnbc: NewsHeadline[] = [];
  const errors: string[] = [];

  try {
    const rows = await takeHeadlines(CNN_RSS, 5);
    cnn.push(...rows);
  } catch (e) {
    console.error("[news] CNN RSS", e);
    errors.push("cnn_feed_failed");
  }

  try {
    const rows = await takeHeadlines(CNBC_RSS, 5);
    cnbc.push(...rows);
  } catch (e) {
    console.error("[news] CNBC RSS", e);
    errors.push("cnbc_feed_failed");
  }

  if (cnn.length === 0 && cnbc.length === 0) {
    res.status(502).json({
      error: "news_feeds_unavailable",
      details: errors,
      cnn: [],
      cnbc: [],
      fetchedAt,
    });
    return;
  }

  res.json({
    cnn,
    cnbc,
    fetchedAt,
    ...(errors.length > 0 ? { partial: true, warnings: errors } : {}),
  });
});

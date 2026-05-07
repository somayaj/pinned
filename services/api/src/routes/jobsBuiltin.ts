import { Router } from "express";
import { z } from "zod";
import * as cheerio from "cheerio";
import * as store from "../store.js";

export const jobsBuiltinRouter = Router();

const POLL_MINUTES = [0, 1, 2, 3, 5, 10, 15, 30] as const;
const POSTED_WITHIN_DAYS = [10, 20, 50, 100] as const;

const putBuiltinJobSettingsBody = z.object({
  pollIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((n) => POLL_MINUTES.includes(n as (typeof POLL_MINUTES)[number]), {
      message: "invalid_poll_interval",
    }),
  keywords: z.string().max(200),
  locations: z.array(z.string().min(1).max(80)).max(10),
  remoteOnly: z.boolean(),
  postedWithinDays: z.coerce
    .number()
    .int()
    .refine(
      (n) =>
        POSTED_WITHIN_DAYS.includes(n as (typeof POSTED_WITHIN_DAYS)[number]),
      { message: "invalid_posted_within_days" }
    ),
  seniority: z.array(z.string().min(1).max(40)).max(10),
  jobType: z.array(z.string().min(1).max(40)).max(10),
  companyAllowlist: z.array(z.string().min(1).max(80)).max(50),
  companyDenylist: z.array(z.string().min(1).max(80)).max(50),
});

function defaultBuiltinJobSettings(): store.BuiltinJobSettingsRow {
  return {
    pollIntervalMinutes: 5,
    keywords: "",
    locations: [],
    remoteOnly: false,
    postedWithinDays: 10,
    seniority: [],
    jobType: [],
    companyAllowlist: [],
    companyDenylist: [],
  };
}

jobsBuiltinRouter.get("/settings", async (req, res) => {
  const userId = req.userId!;
  try {
    const row = await store.getBuiltinJobSettings(userId);
    res.json(row ?? defaultBuiltinJobSettings());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "database_error" });
  }
});

jobsBuiltinRouter.put("/settings", async (req, res) => {
  const userId = req.userId!;
  const parsed = putBuiltinJobSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.flatten() });
    return;
  }
  try {
    const data = parsed.data;
    await store.setBuiltinJobSettings(userId, data);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "database_error" });
  }
});

type BuiltinJobResult = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  postedAt?: string;
};

function uniqBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = key(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchesAnyLocation(location: string, locations: string[]): boolean {
  if (locations.length === 0) return true;
  const hay = normalizeForMatch(location);
  return locations.some((l) => hay.includes(normalizeForMatch(l)));
}

function matchesKeywords(title: string, company: string, keywords: string): boolean {
  const k = normalizeForMatch(keywords);
  if (!k) return true;
  const hay = `${normalizeForMatch(title)} ${normalizeForMatch(company)}`;
  // simple “all tokens must match”
  const tokens = k.split(" ").filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}

function matchesCompanyAllowDeny(company: string, allow: string[], deny: string[]): boolean {
  const c = normalizeForMatch(company);
  if (deny.some((d) => c.includes(normalizeForMatch(d)))) return false;
  if (allow.length === 0) return true;
  return allow.some((a) => c.includes(normalizeForMatch(a)));
}

function isRemoteish(location: string): boolean {
  const s = normalizeForMatch(location);
  return s.includes("remote");
}

function absoluteBuiltinUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `https://builtin.com${path}`;
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "pin-it-api/1.0 (+https://github.com/somayaj/pinned; builtin jobs scrape)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) {
      throw new Error(`builtin_fetch_failed:${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseBuiltinJobsFromHtml(html: string): BuiltinJobResult[] {
  const $ = cheerio.load(html);
  const results: BuiltinJobResult[] = [];

  // BuiltIn’s markup changes; use multiple heuristics:
  // - Prefer job detail links (often /job/...) inside H2/H3 headings
  // - Pull company from nearby /company/ link when available
  const jobLinks = $("h2 a[href], h3 a[href]")
    .toArray()
    .map((el) => $(el));

  for (const $a of jobLinks) {
    const href = String($a.attr("href") ?? "").trim();
    if (!href) continue;
    if (!href.startsWith("/job/") && !href.includes("/job/")) continue;

    const title = normalizeForMatch($a.text()).replace(/^\w/, (c) => c.toUpperCase());
    if (!title) continue;

    const $card = $a.closest("article, li, div").first();
    const company =
      $card.find('a[href^="/company/"]').first().text().trim() ||
      $a.closest("section, article, li, div").find('a[href^="/company/"]').first().text().trim() ||
      "Unknown";

    const cardText = $card.text().replace(/\s+/g, " ").trim();
    // crude location capture: prefer lines containing ", " and "USA" or explicit “Remote”
    let location = "";
    const remoteMatch = cardText.match(/\b(In-Office or Remote|Remote|Hybrid|In-Office)\b/i);
    if (remoteMatch) {
      // keep a nearby location if present
      const after = cardText.slice(remoteMatch.index ?? 0);
      const locMatch =
        after.match(/\b([A-Za-z .'-]+,\s*[A-Z]{2},\s*USA)\b/) ??
        after.match(/\b(\d+\s+Locations)\b/i);
      location = locMatch ? locMatch[1] : remoteMatch[0];
    } else {
      const locMatch = cardText.match(/\b([A-Za-z .'-]+,\s*[A-Z]{2},\s*USA)\b/);
      location = locMatch ? locMatch[1] : "";
    }

    const url = absoluteBuiltinUrl(href);
    results.push({
      id: url,
      title: $a.text().trim(),
      company: company.trim() || "Unknown",
      location: location || "",
      url,
    });
  }

  return uniqBy(results, (r) => r.id);
}

jobsBuiltinRouter.get("/search", async (req, res) => {
  const userId = req.userId!;
  let settings: store.BuiltinJobSettingsRow;
  try {
    settings = (await store.getBuiltinJobSettings(userId)) ?? defaultBuiltinJobSettings();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "database_error" });
    return;
  }

  const baseUrl = settings.remoteOnly ? "https://builtin.com/jobs/remote" : "https://builtin.com/jobs";
  const fetchedAt = new Date().toISOString();

  try {
    const html = await fetchHtml(baseUrl);
    const parsed = parseBuiltinJobsFromHtml(html);

    const filtered = parsed
      .filter((j) => (settings.remoteOnly ? isRemoteish(j.location) || j.location === "" : true))
      .filter((j) => matchesAnyLocation(j.location, settings.locations))
      .filter((j) => matchesKeywords(j.title, j.company, settings.keywords))
      .filter((j) =>
        matchesCompanyAllowDeny(j.company, settings.companyAllowlist, settings.companyDenylist)
      )
      .slice(0, 10);

    res.json({ fetchedAt, items: filtered });
  } catch (e) {
    console.error("[jobs/builtin] scrape failed", e);
    res.status(502).json({ error: "builtin_unavailable", fetchedAt, items: [] });
  }
});


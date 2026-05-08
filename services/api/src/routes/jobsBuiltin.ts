import { Router } from "express";
import { z } from "zod";
import * as cheerio from "cheerio";
import * as store from "../store.js";

export const jobsBuiltinRouter = Router();

const POLL_MINUTES = [0, 1, 2, 3, 5, 10, 15, 30] as const;
const POSTED_WITHIN_DAYS = [1, 3] as const;

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
    postedWithinDays: 1,
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

function isStrictRemote(location: string): boolean {
  const s = normalizeForMatch(location);
  if (!s.includes("remote")) return false;
  // User expectation for “remote only”: exclude hybrid / in-office variants.
  if (s.includes("hybrid")) return false;
  if (s.includes("in-office")) return false;
  return true;
}

function absoluteBuiltinUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  const path = href.startsWith("/") ? href : `/${href}`;
  return `https://builtin.com${path}`;
}

function slugifySearchTerm(raw: string): string {
  const s = raw
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return s;
}

function buildBuiltinJobsUrl(settings: store.BuiltinJobSettingsRow): string {
  const base = settings.remoteOnly ? "https://builtin.com/jobs/remote" : "https://builtin.com/jobs";
  const u = new URL(base);

  // Match the BuiltIn URL format the user wants, e.g.
  // /jobs/remote?search=principal+software+engineer&daysSinceUpdated=1&city=&state=&country=USA&allLocations=true
  const q = (settings.keywords ?? "").trim();
  if (q) u.searchParams.set("search", q);
  // Note: we intentionally do NOT include daysSinceUpdated here. BuiltIn commonly
  // returns different result sets for server-side scraping when that param is set.
  // We keep the UI setting for now, but omit it from the scrape URL.
  // Default to US, all locations (BuiltIn expects these params present in many views).
  u.searchParams.set("country", "USA");
  u.searchParams.set("allLocations", "true");
  u.searchParams.set("city", "");
  u.searchParams.set("state", "");

  return u.toString();
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

  // BuiltIn’s markup changes. Heuristics:
  // - Prefer any anchor that links to /job/...
  // - Use heading anchors first, but fall back to all anchors.
  const headingAnchors = $("h1 a[href], h2 a[href], h3 a[href]")
    .toArray()
    .map((el) => $(el));
  const allAnchors = $("a[href]")
    .toArray()
    .map((el) => $(el));
  const anchors = [...headingAnchors, ...allAnchors];

  for (const $a of anchors) {
    const hrefRaw = String($a.attr("href") ?? "").trim();
    if (!hrefRaw) continue;
    const href = hrefRaw.startsWith("http") ? hrefRaw : hrefRaw;
    if (!href) continue;
    if (!href.includes("/job/")) continue;

    const title = $a.text().replace(/\s+/g, " ").trim();
    if (!title) continue;
    // Ignore “Saved” / UI chrome fragments that sometimes appear as link text
    if (title.length < 3) continue;

    // BuiltIn often places company link in a sibling element, not inside the title anchor container.
    const $container = $a.closest("section, article, li, div");
    const company =
      $container.find('a[href^="/company/"][data-id="company-title"]').first().text().trim() ||
      $container.find('a[href^="/company/"]').first().text().trim() ||
      (() => {
        const alt = $container.find("img[alt]").first().attr("alt");
        if (alt && /logo/i.test(alt)) {
          const cleaned = String(alt).replace(/\s+logo\s*$/i, "").trim();
          if (cleaned) return cleaned;
        }
        return "";
      })() ||
      "Unknown";

    const cardText = $container.text().replace(/\s+/g, " ").trim();
    // crude location capture: prefer explicit “Remote/Hybrid” label plus nearby location if present
    let location = "";
    const remoteMatch = cardText.match(/\b(In-Office or Remote|Remote|Hybrid|In-Office)\b/i);
    if (remoteMatch) {
      const label = remoteMatch[0];
      // keep a nearby location if present
      const after = cardText.slice(remoteMatch.index ?? 0);
      const locMatch =
        after.match(/\b([A-Za-z .'-]+,\s*[A-Z]{2},\s*USA)\b/) ??
        after.match(/\b(\d+\s+Locations)\b/i);
      location = locMatch ? `${label} · ${locMatch[1]}` : label;
    } else {
      const locMatch = cardText.match(/\b([A-Za-z .'-]+,\s*[A-Z]{2},\s*USA)\b/);
      location = locMatch ? locMatch[1] : "";
    }

    const url = absoluteBuiltinUrl(hrefRaw);
    results.push({
      id: url,
      title,
      company: company.trim() || "Unknown",
      location: location || "",
      url,
    });
  }

  // Keep first occurrences; also cap parse output to avoid pathological pages.
  return uniqBy(results, (r) => r.id).slice(0, 200);
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

  const sourceUrl = buildBuiltinJobsUrl(settings);
  const fetchedAt = new Date().toISOString();

  try {
    const html = await fetchHtml(sourceUrl);
    const parsed = parseBuiltinJobsFromHtml(html);
    if (parsed.length === 0) {
      res.status(502).json({
        error: "builtin_parse_failed",
        fetchedAt,
        sourceUrl,
        items: [],
        warnings: ["no_job_links_found"],
      });
      return;
    }

    const filtered = parsed
      // When remoteOnly is enabled we already use /jobs/remote; avoid being overly strict
      // but still enforce the user's expectation: remote means not hybrid / in-office.
      .filter((j) => (settings.remoteOnly ? isStrictRemote(j.location) : true))
      .filter((j) => matchesAnyLocation(j.location, settings.locations))
      .filter((j) => matchesKeywords(j.title, j.company, settings.keywords))
      .filter((j) =>
        matchesCompanyAllowDeny(j.company, settings.companyAllowlist, settings.companyDenylist)
      )
      .slice(0, 10);

    if (filtered.length === 0) {
      const hasAnyFilters =
        Boolean(settings.remoteOnly) ||
        (settings.keywords ?? "").trim().length > 0 ||
        (settings.locations?.length ?? 0) > 0 ||
        (settings.companyAllowlist?.length ?? 0) > 0 ||
        (settings.companyDenylist?.length ?? 0) > 0;

      // If the user set filters (like keywords), do NOT return unrelated jobs — return
      // an explicit “no matches” response so the UI doesn’t mislead them.
      if (hasAnyFilters) {
        res.json({
          fetchedAt,
          sourceUrl,
          parsedCount: parsed.length,
          items: [],
          partial: true,
          warnings: ["no_matches_using_filters"],
        });
        return;
      }

      // No filters set → return top results so the feature is still useful by default.
      res.json({
        fetchedAt,
        sourceUrl,
        parsedCount: parsed.length,
        items: parsed.slice(0, 10),
        partial: true,
        warnings: ["no_filters_set"],
      });
      return;
    }

    res.json({ fetchedAt, sourceUrl, parsedCount: parsed.length, items: filtered });
  } catch (e) {
    console.error("[jobs/builtin] scrape failed", e);
    res.status(502).json({ error: "builtin_unavailable", fetchedAt, sourceUrl, items: [] });
  }
});


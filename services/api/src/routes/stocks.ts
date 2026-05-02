import { Router } from "express";
import YahooFinance from "yahoo-finance2";
import { z } from "zod";
import * as store from "../store.js";

/** v3 requires a constructed instance (see yahoo-finance2 UPGRADING.md). */
const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

export const stockRouter = Router();

const YAHOO_QUOTE_RETRIES = 3;

function isTransientYahooNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (err instanceof TypeError && /fetch failed/i.test(msg)) return true;
  const blob = `${msg}${err instanceof Error && err.cause ? String(err.cause) : ""}`;
  return /ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN/i.test(blob);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Yahoo crumb / quote often hit ETIMEDOUT from cloud hosts; brief backoff retries help. */
async function yahooQuoteWithRetries(symbols: string[]) {
  let last: unknown;
  for (let attempt = 0; attempt < YAHOO_QUOTE_RETRIES; attempt++) {
    try {
      return await yahooFinance.quote(symbols);
    } catch (e) {
      last = e;
      if (!isTransientYahooNetworkError(e) || attempt === YAHOO_QUOTE_RETRIES - 1) {
        throw e;
      }
      const waitMs = 1200 * (attempt + 1);
      console.warn(
        `[stocks] yahoo quote transient error (attempt ${attempt + 1}/${YAHOO_QUOTE_RETRIES}), retry in ${waitMs}ms`
      );
      await sleep(waitMs);
    }
  }
  throw last;
}

const MAX_SYMBOLS = 10;

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Letters, digits, dot, caret (indices) — e.g. AAPL, BRK.B, ^GSPC */
function isValidSymbol(s: string): boolean {
  return /^[\^]?[A-Z0-9][A-Z0-9.-]{0,14}$/.test(s) && s.length <= 16;
}

const putWatchlistBody = z.object({
  symbols: z.array(z.string().min(1).max(16)).max(MAX_SYMBOLS),
  pollIntervalMinutes: z.coerce
    .number()
    .int()
    .refine((n) => n === 0 || (n >= 1 && n <= 60), {
      message: "invalid_poll_interval",
    })
    .optional(),
});

export type StockQuoteOut = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  currency: string;
  shortName: string | null;
};

function mapQuote(q: Record<string, unknown>): StockQuoteOut {
  const row = q as {
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
    currency?: string;
    shortName?: string;
  };
  return {
    symbol: String(row.symbol ?? ""),
    price:
      row.regularMarketPrice != null && !Number.isNaN(row.regularMarketPrice)
        ? row.regularMarketPrice
        : null,
    change:
      row.regularMarketChange != null && !Number.isNaN(row.regularMarketChange)
        ? row.regularMarketChange
        : null,
    changePercent:
      row.regularMarketChangePercent != null &&
      !Number.isNaN(row.regularMarketChangePercent)
        ? row.regularMarketChangePercent
        : null,
    currency: row.currency ?? "USD",
    shortName: row.shortName ?? null,
  };
}

stockRouter.get("/watchlist", async (req, res) => {
  const userId = req.userId!;
  try {
    const row = await store.getStockWatchlist(userId);
    res.json({
      symbols: row?.symbols ?? [],
      pollIntervalMinutes: row?.pollIntervalMinutes ?? 5,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

stockRouter.put("/watchlist", async (req, res) => {
  const userId = req.userId!;
  const parsed = putWatchlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const seen = new Set<string>();
  const symbols: string[] = [];
  for (const s of parsed.data.symbols) {
    const n = normalizeSymbol(s);
    if (!isValidSymbol(n)) {
      res.status(400).json({ error: `invalid_symbol:${n}` });
      return;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    symbols.push(n);
    if (symbols.length > MAX_SYMBOLS) {
      res.status(400).json({ error: "too_many_symbols" });
      return;
    }
  }
  const pollIntervalMinutes = parsed.data.pollIntervalMinutes ?? 5;
  try {
    await store.setStockWatchlist(userId, { symbols, pollIntervalMinutes });
    res.json({
      symbols,
      pollIntervalMinutes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
  }
});

stockRouter.get("/quotes", async (req, res) => {
  const userId = req.userId!;
  const raw = String(req.query.symbols ?? "").trim();
  if (!raw) {
    res.status(400).json({ error: "missing_symbols" });
    return;
  }
  const requested = raw
    .split(",")
    .map((s) => normalizeSymbol(s))
    .filter(Boolean);
  if (requested.length === 0) {
    res.status(400).json({ error: "missing_symbols" });
    return;
  }
  if (requested.length > MAX_SYMBOLS) {
    res.status(400).json({ error: "too_many_symbols" });
    return;
  }
  try {
    const wl = await store.getStockWatchlist(userId);
    const allowed = new Set(wl?.symbols ?? []);
    for (const s of requested) {
      if (!allowed.has(s)) {
        res.status(403).json({ error: "symbol_not_in_watchlist", symbol: s });
        return;
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "database_error" });
    return;
  }

  try {
    const results = await yahooQuoteWithRetries(requested);
    const list = Array.isArray(results) ? results : [results];
    const quotes: StockQuoteOut[] = list.map((row) =>
      mapQuote(row as Record<string, unknown>)
    );
    res.json({ quotes, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[stocks] yahoo quote", err);
    res.status(502).json({ error: "quote_provider_failed" });
  }
});

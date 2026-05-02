import { Router } from "express";
import YahooFinance from "yahoo-finance2";
import { z } from "zod";
import * as store from "../store.js";

/** v3 requires a constructed instance (see yahoo-finance2 UPGRADING.md). */
const yahooFinance = new YahooFinance();

export const stockRouter = Router();

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
    .min(1)
    .max(60)
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
    const results = await yahooFinance.quote(requested);
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

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useTasks } from "./TasksContext";
import {
  fetchStockQuotes,
  fetchStockWatchlist,
  type StockQuote,
  type StockWatchlistResponse,
} from "../lib/api";
import { playStocksUpdateSound } from "../lib/alertSound";

type StockAlertPayload = {
  quotes: StockQuote[];
  fetchedAt: string;
};

type StocksContextValue = {
  symbols: string[];
  pollIntervalMinutes: number;
  lastAlert: StockAlertPayload | null;
  refreshWatchlist: () => Promise<void>;
  /** Apply server-confirmed watchlist (e.g. after PUT) so UI updates even if GET fails. */
  applyWatchlistSnapshot: (w: StockWatchlistResponse) => void;
  dismissAlert: () => void;
};

const StocksContext = createContext<StocksContextValue | null>(null);

export function StocksProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const { apiBase } = useTasks();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(5);
  const [lastAlert, setLastAlert] = useState<StockAlertPayload | null>(null);

  const refreshWatchlist = useCallback(async () => {
    if (!accessToken) return;
    try {
      const w = await fetchStockWatchlist(apiBase, accessToken);
      setSymbols(w.symbols);
      setPollIntervalMinutes(w.pollIntervalMinutes);
    } catch {
      /* older API or offline */
    }
  }, [accessToken, apiBase]);

  const applyWatchlistSnapshot = useCallback((w: StockWatchlistResponse) => {
    setSymbols(w.symbols);
    setPollIntervalMinutes(w.pollIntervalMinutes);
  }, []);

  useEffect(() => {
    void refreshWatchlist();
  }, [refreshWatchlist]);

  useEffect(() => {
    if (!accessToken || symbols.length === 0) {
      return;
    }
    let cancelled = false;
    const ms = Math.max(1, pollIntervalMinutes) * 60 * 1000;

    const tick = async () => {
      try {
        const data = await fetchStockQuotes(apiBase, accessToken, symbols);
        if (!cancelled && data.quotes.length > 0) {
          playStocksUpdateSound();
          setLastAlert({
            quotes: data.quotes,
            fetchedAt: data.fetchedAt,
          });
        }
      } catch {
        /* quote errors are non-fatal */
      }
    };

    void tick();
    const id = setInterval(() => void tick(), ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, apiBase, symbols, pollIntervalMinutes]);

  const dismissAlert = useCallback(() => setLastAlert(null), []);

  const value = useMemo(
    () => ({
      symbols,
      pollIntervalMinutes,
      lastAlert,
      refreshWatchlist,
      applyWatchlistSnapshot,
      dismissAlert,
    }),
    [
      symbols,
      pollIntervalMinutes,
      lastAlert,
      refreshWatchlist,
      applyWatchlistSnapshot,
      dismissAlert,
    ]
  );

  return (
    <StocksContext.Provider value={value}>{children}</StocksContext.Provider>
  );
}

export function useStocks(): StocksContextValue {
  const ctx = useContext(StocksContext);
  if (!ctx) {
    throw new Error("useStocks must be used within StocksProvider");
  }
  return ctx;
}

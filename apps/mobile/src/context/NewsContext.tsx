import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useTasks } from "./TasksContext";
import {
  fetchNewsHeadlines,
  type NewsHeadline,
  type NewsHeadlinesResponse,
} from "../lib/api";
import { playNewsSound } from "../lib/alertSound";

const POLL_MS = 20 * 60 * 1000;

type NewsAlertPayload = {
  cnn: NewsHeadline[];
  cnbc: NewsHeadline[];
  fetchedAt: string;
  partial?: boolean;
  warnings?: string[];
};

type NewsContextValue = {
  lastAlert: NewsAlertPayload | null;
  dismissAlert: () => void;
};

const NewsContext = createContext<NewsContextValue | null>(null);

function digestHeadlines(data: NewsHeadlinesResponse): string {
  const c = data.cnn.map((h) => h.title).join("\u0001");
  const b = data.cnbc.map((h) => h.title).join("\u0001");
  return `${c}\u0002${b}`;
}

export function NewsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const { apiBase } = useTasks();
  const [lastAlert, setLastAlert] = useState<NewsAlertPayload | null>(null);
  const lastDigestRef = useRef<string | null>(null);

  const dismissAlert = useCallback(() => setLastAlert(null), []);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const data = await fetchNewsHeadlines(apiBase, accessToken);
        if (cancelled) return;
        const d = digestHeadlines(data);
        const hasItems = data.cnn.length > 0 || data.cnbc.length > 0;
        if (!hasItems) return;

        if (lastDigestRef.current !== null && d === lastDigestRef.current) {
          return;
        }
        lastDigestRef.current = d;

        playNewsSound();
        setLastAlert({
          cnn: data.cnn,
          cnbc: data.cnbc,
          fetchedAt: data.fetchedAt,
          partial: data.partial,
          warnings: data.warnings,
        });
      } catch {
        /* RSS / network errors are non-fatal */
      }
    };

    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, apiBase]);

  const value = useMemo(
    () => ({ lastAlert, dismissAlert }),
    [lastAlert, dismissAlert]
  );

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews(): NewsContextValue {
  const ctx = useContext(NewsContext);
  if (!ctx) {
    throw new Error("useNews must be used within NewsProvider");
  }
  return ctx;
}

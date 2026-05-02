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
  fetchNewsSettings,
  type NewsHeadline,
  type NewsHeadlinesResponse,
} from "../lib/api";
import { playNewsSound } from "../lib/alertSound";

type NewsAlertPayload = {
  cnn: NewsHeadline[];
  cnbc: NewsHeadline[];
  fetchedAt: string;
  partial?: boolean;
  warnings?: string[];
};

type NewsContextValue = {
  pollIntervalMinutes: number;
  lastAlert: NewsAlertPayload | null;
  dismissAlert: () => void;
  refreshNewsSettings: () => Promise<void>;
  applyNewsSettingsSnapshot: (s: { pollIntervalMinutes: number }) => void;
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
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(5);
  const [lastAlert, setLastAlert] = useState<NewsAlertPayload | null>(null);
  const lastDigestRef = useRef<string | null>(null);

  const dismissAlert = useCallback(() => setLastAlert(null), []);

  const refreshNewsSettings = useCallback(async () => {
    if (!accessToken) return;
    try {
      const s = await fetchNewsSettings(apiBase, accessToken);
      setPollIntervalMinutes(s.pollIntervalMinutes);
    } catch {
      /* older API or offline */
    }
  }, [accessToken, apiBase]);

  const applyNewsSettingsSnapshot = useCallback(
    (s: { pollIntervalMinutes: number }) => {
      setPollIntervalMinutes(s.pollIntervalMinutes);
    },
    []
  );

  useEffect(() => {
    void refreshNewsSettings();
  }, [refreshNewsSettings]);

  useEffect(() => {
    if (!accessToken) return;
    if (pollIntervalMinutes === 0) {
      return;
    }
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
    const ms = pollIntervalMinutes * 60 * 1000;
    const id = setInterval(() => void tick(), ms);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [accessToken, apiBase, pollIntervalMinutes]);

  const value = useMemo(
    () => ({
      pollIntervalMinutes,
      lastAlert,
      dismissAlert,
      refreshNewsSettings,
      applyNewsSettingsSnapshot,
    }),
    [
      pollIntervalMinutes,
      lastAlert,
      dismissAlert,
      refreshNewsSettings,
      applyNewsSettingsSnapshot,
    ]
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

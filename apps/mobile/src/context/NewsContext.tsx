import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
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
  const pollDepsRef = useRef({
    accessToken: "" as string | undefined,
    apiBase: "",
    pollIntervalMinutes: 5,
  });
  pollDepsRef.current = {
    accessToken: accessToken ?? undefined,
    apiBase,
    pollIntervalMinutes,
  };

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
      const { accessToken: token, apiBase: base, pollIntervalMinutes: pollM } =
        pollDepsRef.current;
      if (!token || pollM === 0) return;
      try {
        const data = await fetchNewsHeadlines(base, token);
        if (cancelled) return;
        const d = digestHeadlines(data);
        const hasItems = data.cnn.length > 0 || data.cnbc.length > 0;
        if (!hasItems) return;

        const digestChanged =
          lastDigestRef.current === null || d !== lastDigestRef.current;
        lastDigestRef.current = d;

        if (digestChanged) {
          playNewsSound();
        }

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

    const onAppActive = (s: string) => {
      if (s === "active") void tick();
    };
    const appSub = AppState.addEventListener("change", onAppActive);

    let removeVis: (() => void) | undefined;
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVis = () => {
        if (!document.hidden) void tick();
      };
      document.addEventListener("visibilitychange", onVis);
      removeVis = () => document.removeEventListener("visibilitychange", onVis);
    }

    return () => {
      cancelled = true;
      clearInterval(id);
      appSub.remove();
      removeVis?.();
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

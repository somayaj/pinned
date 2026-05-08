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
  fetchBuiltinJobs,
  fetchBuiltinJobSettings,
  type BuiltinJobResult,
  type BuiltinJobSettingsResponse,
  type BuiltinJobsResponse,
} from "../lib/api";
import { playJobsSound } from "../lib/alertSound";

type BuiltinJobsAlertPayload = {
  items: BuiltinJobResult[];
  fetchedAt: string;
};

type BuiltinJobsContextValue = {
  settings: BuiltinJobSettingsResponse;
  lastAlert: BuiltinJobsAlertPayload | null;
  dismissAlert: () => void;
  refreshSettings: () => Promise<void>;
  applySettingsSnapshot: (s: BuiltinJobSettingsResponse) => void;
};

const BuiltinJobsContext = createContext<BuiltinJobsContextValue | null>(null);

function defaultSettings(): BuiltinJobSettingsResponse {
  return {
    pollIntervalMinutes: 5,
    keywords: "",
    remoteOnly: false,
  };
}

function digestJobs(data: BuiltinJobsResponse): string {
  return data.items.map((i) => i.id || i.url).join("\u0001");
}

export function BuiltinJobsProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const { apiBase } = useTasks();
  const [settings, setSettings] = useState<BuiltinJobSettingsResponse>(defaultSettings);
  const [lastAlert, setLastAlert] = useState<BuiltinJobsAlertPayload | null>(null);
  const lastAlertRef = useRef<BuiltinJobsAlertPayload | null>(null);
  lastAlertRef.current = lastAlert;
  const lastDigestRef = useRef<string | null>(null);
  const pollDepsRef = useRef({
    accessToken: "" as string | undefined,
    apiBase: "",
    settings: defaultSettings(),
  });
  pollDepsRef.current = {
    accessToken: accessToken ?? undefined,
    apiBase,
    settings,
  };

  const dismissAlert = useCallback(() => setLastAlert(null), []);

  const refreshSettings = useCallback(async () => {
    if (!accessToken) return;
    try {
      const s = await fetchBuiltinJobSettings(apiBase, accessToken);
      setSettings(s);
    } catch {
      /* older API or offline */
    }
  }, [accessToken, apiBase]);

  const applySettingsSnapshot = useCallback((s: BuiltinJobSettingsResponse) => {
    setSettings(s);
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  useEffect(() => {
    if (!accessToken) return;
    if (settings.pollIntervalMinutes === 0) return;
    let cancelled = false;

    const tick = async () => {
      const { accessToken: token, apiBase: base, settings: s } = pollDepsRef.current;
      if (!token || s.pollIntervalMinutes === 0) return;
      try {
        const data = await fetchBuiltinJobs(base, token);
        if (cancelled) return;
        if (!data.items || data.items.length === 0) return;

        const d = digestJobs(data);
        const digestChanged = lastDigestRef.current === null || d !== lastDigestRef.current;
        lastDigestRef.current = d;
        if (digestChanged) {
          playJobsSound();
        }

        // Show jobs even when nothing is "new", but avoid resetting the toast/timer
        // every poll while it's already visible.
        if (digestChanged || lastAlertRef.current === null) {
          setLastAlert({ items: data.items, fetchedAt: data.fetchedAt });
        }
      } catch {
        /* scrape / network errors are non-fatal */
      }
    };

    void tick();
    const ms = settings.pollIntervalMinutes * 60 * 1000;
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
  }, [accessToken, apiBase, settings.pollIntervalMinutes]);

  const value = useMemo(
    () => ({
      settings,
      lastAlert,
      dismissAlert,
      refreshSettings,
      applySettingsSnapshot,
    }),
    [settings, lastAlert, dismissAlert, refreshSettings, applySettingsSnapshot]
  );

  return <BuiltinJobsContext.Provider value={value}>{children}</BuiltinJobsContext.Provider>;
}

export function useBuiltinJobs(): BuiltinJobsContextValue {
  const ctx = useContext(BuiltinJobsContext);
  if (!ctx) {
    throw new Error("useBuiltinJobs must be used within BuiltinJobsProvider");
  }
  return ctx;
}


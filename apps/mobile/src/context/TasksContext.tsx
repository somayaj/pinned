import * as Notifications from "expo-notifications";
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
import * as api from "../lib/api";
import {
  DEFAULT_API_BASE,
  getApiBaseUrl,
  setApiBaseUrl,
  toWebSocketUrl,
} from "../lib/config";
import type { Task } from "../types/task";
import { useAuth } from "./AuthContext";

/** Avoids expo-notifications push-token listener on web (unsupported; spams console). */
if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

type WsStatus = "off" | "connecting" | "on";

type TasksContextValue = {
  tasks: Task[];
  apiBase: string;
  setApiBase: (url: string) => Promise<void>;
  wsStatus: WsStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTask: (input: {
    title: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    remindAt: string | null;
  }) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [apiBase, setApiBaseState] = useState(DEFAULT_API_BASE);
  const [wsStatus, setWsStatus] = useState<WsStatus>("off");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);

  const clearReconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    const base = await getApiBaseUrl();
    setApiBaseState(base);
    setError(null);
    const list = await api.fetchTasks(base, accessToken);
    setTasks(list);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base = await getApiBaseUrl();
        if (!cancelled) setApiBaseState(base);
        const list = await api.fetchTasks(base, accessToken);
        if (!cancelled) setTasks(list);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load tasks";
          setError(msg === "session_expired" ? "Please sign in again." : msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (Platform.OS === "android") {
      void Notifications.setNotificationChannelAsync("reminders", {
        name: "Pin reminders",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0ea5e9",
      });
    }
  }, []);

  const setApiBase = useCallback(
    async (url: string) => {
      await setApiBaseUrl(url);
      const normalized = await getApiBaseUrl();
      setApiBaseState(normalized);
      setError(null);
      if (!accessToken) return;
      try {
        const list = await api.fetchTasks(normalized, accessToken);
        setTasks(list);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load tasks");
      }
    },
    [accessToken]
  );

  const connectWs = useCallback(() => {
    if (!accessToken) return;
    clearReconnect();
    const url = toWebSocketUrl(apiBase, accessToken);
    setWsStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("on");
      attemptRef.current = 0;
    };

    ws.onclose = () => {
      setWsStatus("off");
      wsRef.current = null;
      if (!accessToken) return;
      const delay = Math.min(
        30_000,
        1000 * Math.pow(2, attemptRef.current++)
      );
      reconnectTimer.current = setTimeout(connectWs, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          type?: string;
          tasks?: Task[];
        };
        if (msg.type === "tasks_updated" && Array.isArray(msg.tasks)) {
          setTasks(msg.tasks);
        }
      } catch {
        /* ignore */
      }
    };
  }, [apiBase, accessToken, clearReconnect]);

  useEffect(() => {
    if (!accessToken) {
      clearReconnect();
      wsRef.current?.close();
      setWsStatus("off");
      return;
    }
    connectWs();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refresh();
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connectWs();
        }
      }
    });
    return () => {
      sub.remove();
      clearReconnect();
      wsRef.current?.close();
    };
  }, [connectWs, clearReconnect, refresh, accessToken]);

  const addTask = useCallback(
    async (input: {
      title: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      remindAt: string | null;
    }) => {
      if (!accessToken) return;
      const task = await api.createTask(apiBase, accessToken, input);
      setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
    },
    [apiBase, accessToken]
  );

  const removeTask = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      await api.deleteTask(apiBase, accessToken, id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [apiBase, accessToken]
  );

  const value = useMemo(
    () => ({
      tasks,
      apiBase,
      setApiBase,
      wsStatus,
      loading,
      error,
      refresh,
      addTask,
      removeTask,
    }),
    [
      tasks,
      apiBase,
      setApiBase,
      wsStatus,
      loading,
      error,
      refresh,
      addTask,
      removeTask,
    ]
  );

  return (
    <TasksContext.Provider value={value}>{children}</TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) {
    throw new Error("useTasks must be used within TasksProvider");
  }
  return ctx;
}

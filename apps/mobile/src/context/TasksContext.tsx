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
import type { Location } from "../types/location";
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
  locations: Location[];
  apiBase: string;
  setApiBase: (url: string) => Promise<void>;
  wsStatus: WsStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addTask: (input: {
    title: string;
    description?: string | null;
    locationId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
    remindAt: string | null;
  }) => Promise<void>;
  addLocation: (input: {
    name: string;
    description?: string | null;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }) => Promise<Location>;
  removeLocation: (id: string) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  /** Remove every reminder; saved places are kept. */
  deleteAllTasks: () => Promise<void>;
  /** Web: in-app banner when server broadcasts task_alert (app-like feedback in the tab). */
  taskAlert: { task: Task; reason: string } | null;
  /** Close the banner; nudges and alerts keep working. */
  acknowledgeTaskAlert: () => void;
  /** Close the banner and mute reminders for that pin until you tap Resume on the pin. */
  dismissTaskAlertMuteReminders: () => void;
  /** Mute nudges + web overlay for this task until Resume (fallback banner Dismiss). */
  muteRemindersForTask: (taskId: string) => void;
  /** Turn nudges and overlay back on for this pin. */
  resumeRemindersForTask: (taskId: string) => void;
  /** Task ids with reminders muted after Dismiss — until Resume or pin removed. */
  reminderMutedTaskIds: readonly string[];
};

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [apiBase, setApiBaseState] = useState(DEFAULT_API_BASE);
  const [wsStatus, setWsStatus] = useState<WsStatus>("off");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskAlert, setTaskAlert] = useState<{
    task: Task;
    reason: string;
  } | null>(null);
  /** Pending web overlays when a new `task_alert` arrives while one is visible. */
  const taskAlertQueueRef = useRef<{ task: Task; reason: string }[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const [reminderMutedTaskIds, setReminderMutedTaskIds] = useState<string[]>(
    []
  );
  /** Latest muted ids for WebSocket handler (avoids reconnecting WS on mute changes). */
  const reminderMutedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    reminderMutedIdsRef.current = new Set(reminderMutedTaskIds);
  }, [reminderMutedTaskIds]);

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
    const [list, locs] = await Promise.all([
      api.fetchTasks(base, accessToken),
      api.fetchLocations(base, accessToken),
    ]);
    setTasks(list);
    setLocations(locs);
  }, [accessToken]);

  const acknowledgeTaskAlert = useCallback(() => {
    setTaskAlert(() => taskAlertQueueRef.current.shift() ?? null);
  }, []);

  const dismissTaskAlertMuteReminders = useCallback(() => {
    setTaskAlert((prev) => {
      if (prev) {
        const id = prev.task.id;
        setReminderMutedTaskIds((m) => (m.includes(id) ? m : [...m, id]));
        taskAlertQueueRef.current = taskAlertQueueRef.current.filter(
          (e) => e.task.id !== id
        );
      }
      return taskAlertQueueRef.current.shift() ?? null;
    });
  }, []);

  const muteRemindersForTask = useCallback((taskId: string) => {
    setReminderMutedTaskIds((m) => (m.includes(taskId) ? m : [...m, taskId]));
  }, []);

  const resumeRemindersForTask = useCallback((taskId: string) => {
    setReminderMutedTaskIds((m) => m.filter((id) => id !== taskId));
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setTasks([]);
      setLocations([]);
      setLoading(false);
      setError(null);
      setTaskAlert(null);
      taskAlertQueueRef.current = [];
      setReminderMutedTaskIds([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const base = await getApiBaseUrl();
        if (!cancelled) setApiBaseState(base);
        const [list, locs] = await Promise.all([
          api.fetchTasks(base, accessToken),
          api.fetchLocations(base, accessToken),
        ]);
        if (!cancelled) {
          setTasks(list);
          setLocations(locs);
        }
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
        sound: "default",
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
        const [list, locs] = await Promise.all([
          api.fetchTasks(normalized, accessToken),
          api.fetchLocations(normalized, accessToken),
        ]);
        setTasks(list);
        setLocations(locs);
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
          task?: Task;
          reason?: string;
        };
        if (msg.type === "tasks_updated" && Array.isArray(msg.tasks)) {
          setTasks(msg.tasks);
          void (async () => {
            try {
              const base = await getApiBaseUrl();
              const locs = await api.fetchLocations(base, accessToken);
              setLocations(locs);
            } catch {
              /* ignore */
            }
          })();
        }
        if (
          Platform.OS === "web" &&
          msg.type === "task_alert" &&
          msg.task
        ) {
          if (reminderMutedIdsRef.current.has(msg.task.id)) return;
          const entry = { task: msg.task, reason: msg.reason ?? "" };
          setTaskAlert((current) => {
            if (current === null) return entry;
            taskAlertQueueRef.current.push(entry);
            return current;
          });
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
      description?: string | null;
      locationId?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      radiusMeters?: number | null;
      remindAt: string | null;
    }) => {
      if (!accessToken) return;
      const task = await api.createTask(apiBase, accessToken, input);
      setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)]);
    },
    [apiBase, accessToken]
  );

  const addLocation = useCallback(
    async (input: {
      name: string;
      description?: string | null;
      latitude: number;
      longitude: number;
      radiusMeters: number;
    }) => {
      if (!accessToken) throw new Error("Not signed in");
      const loc = await api.createLocation(apiBase, accessToken, input);
      setLocations((prev) => [loc, ...prev.filter((l) => l.id !== loc.id)]);
      return loc;
    },
    [apiBase, accessToken]
  );

  const removeLocation = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      await api.deleteLocation(apiBase, accessToken, id);
      setLocations((prev) => prev.filter((l) => l.id !== id));
      setTasks((prev) => prev.filter((t) => t.locationId !== id));
    },
    [apiBase, accessToken]
  );

  const removeTask = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      await api.deleteTask(apiBase, accessToken, id);
      setReminderMutedTaskIds((m) => m.filter((x) => x !== id));
      taskAlertQueueRef.current = taskAlertQueueRef.current.filter(
        (e) => e.task.id !== id
      );
      setTaskAlert((cur) => {
        if (cur?.task.id === id) {
          return taskAlertQueueRef.current.shift() ?? null;
        }
        return cur;
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [apiBase, accessToken]
  );

  const deleteAllTasks = useCallback(async () => {
    if (!accessToken) return;
    const list = await api.deleteAllTasks(apiBase, accessToken);
    setTasks(list);
    setReminderMutedTaskIds([]);
    taskAlertQueueRef.current = [];
    setTaskAlert(null);
  }, [apiBase, accessToken]);

  const value = useMemo(
    () => ({
      tasks,
      locations,
      apiBase,
      setApiBase,
      wsStatus,
      loading,
      error,
      refresh,
      addTask,
      addLocation,
      removeLocation,
      removeTask,
      deleteAllTasks,
      taskAlert,
      acknowledgeTaskAlert,
      dismissTaskAlertMuteReminders,
      muteRemindersForTask,
      resumeRemindersForTask,
      reminderMutedTaskIds,
    }),
    [
      tasks,
      locations,
      apiBase,
      setApiBase,
      wsStatus,
      loading,
      error,
      refresh,
      addTask,
      addLocation,
      removeLocation,
      removeTask,
      deleteAllTasks,
      taskAlert,
      acknowledgeTaskAlert,
      dismissTaskAlertMuteReminders,
      muteRemindersForTask,
      resumeRemindersForTask,
      reminderMutedTaskIds,
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

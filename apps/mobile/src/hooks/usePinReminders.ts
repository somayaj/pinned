import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { useTasks } from "../context/TasksContext";
import { playPinnedAlertSound } from "../lib/alertSound";
import * as api from "../lib/api";
import { distanceMeters } from "../lib/geo";
import type { Task } from "../types/task";

function isPinTask(task: Task): boolean {
  return (
    task.latitude != null &&
    task.longitude != null &&
    task.radiusMeters != null
  );
}

function reminderNotificationBody(task: Task): string {
  const base = isPinTask(task)
    ? `You're at: ${task.title}`
    : `Reminder: ${task.title}`;
  const d = task.description?.trim();
  if (!d) return base;
  const extra = d.length > 200 ? `${d.slice(0, 200)}…` : d;
  return `${base} — ${extra}`;
}

/** While inside a pin, repeat nudge + notification at this interval. */
const NUDGE_INTERVAL_MS = 60_000;
/** Re-evaluate reminders on a timer — GPS callbacks often stop when you stand still (esp. web). */
const LOCATION_TICK_MS = 15_000;

function canUseBrowserNotifications(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "Notification" in window
  );
}

type ReminderPresentation = "web_os" | "native" | "web_fallback";

/**
 * Web: `expo-notifications` does not show system banners reliably; use the Web Notifications API.
 * Returns `web_fallback` when the caller should batch in-app UI (no OS banner).
 * Each OS notification uses a unique `tag` so repeats and multiple pins do not replace each other.
 */
async function presentReminderForTask(task: Task): Promise<ReminderPresentation> {
  const body = reminderNotificationBody(task);
  if (canUseBrowserNotifications()) {
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        const origin =
          typeof window !== "undefined" ? window.location.origin : "";
        const icon = `${origin}/pin-it-logo.svg`;
        const tag = `${task.id}-${Date.now()}`;
        playPinnedAlertSound();
        new Notification("Pin it", {
          body,
          tag,
          icon,
          badge: icon,
        });
        return "web_os";
      }
      return "web_fallback";
    } catch {
      return "web_fallback";
    }
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Pin it",
      body,
      data: { taskId: task.id },
      sound: true,
      ...(Platform.OS === "android"
        ? { android: { channelId: "reminders" } }
        : {}),
    },
    trigger: null,
  });
  return "native";
}

/**
 * While inside a task's radius (and past remindAt if set): notification + POST nudge
 * every {@link NUDGE_INTERVAL_MS} (WebSocket `task_alert` for web overlay).
 * Multiple pins in one scan each get their own OS notification (unique tags) or one
 * combined in-app fallback batch; throttle timestamp updates only after nudge succeeds.
 */
export function usePinReminders(
  tasks: Task[],
  apiBase: string,
  accessToken: string | null,
  enabled: boolean,
  onWebInAppFallback?: (tasks: Task[]) => void
) {
  const safeRemoveLocationSubscription = () => {
    try {
      // expo-location web currently can throw during remove() in some setups
      // (LocationEventEmitter.removeSubscription missing). Never crash the app on cleanup.
      (subRef.current as unknown as { remove?: () => void } | null)?.remove?.();
    } catch {
      /* ignore */
    } finally {
      subRef.current = null;
    }
  };

  const { reminderMutedTaskIds } = useTasks();
  const mutedByDismiss = useMemo(
    () => new Set(reminderMutedTaskIds),
    [reminderMutedTaskIds]
  );
  const insideRef = useRef<Map<string, boolean>>(new Map());
  /** Last epoch ms we nudged for this task while still inside the zone. */
  const lastNudgeAtRef = useRef<Map<string, number>>(new Map());
  const lastCoordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken) {
      insideRef.current.clear();
      lastNudgeAtRef.current.clear();
      lastCoordsRef.current = null;
      safeRemoveLocationSubscription();
      return;
    }

    let cancelled = false;
    let tickId: ReturnType<typeof setInterval> | null = null;

    const runScan = async (latitude: number, longitude: number) => {
      const now = Date.now();
      const webFallbackBatch: Task[] = [];

      for (const task of tasks) {
        if (!isPinTask(task)) {
          if (!task.remindAt || task.remindAt === "") continue;
          if (now < new Date(task.remindAt).getTime()) continue;
          if (mutedByDismiss.has(task.id)) continue;

          const lastNudge = lastNudgeAtRef.current.get(task.id);
          if (lastNudge != null && now - lastNudge < NUDGE_INTERVAL_MS) {
            continue;
          }

          try {
            const mode = await presentReminderForTask(task);
            if (mode === "web_fallback") {
              webFallbackBatch.push(task);
            }
            await api.nudgeTask(apiBase, accessToken, task.id);
            lastNudgeAtRef.current.set(task.id, Date.now());
          } catch {
            /* ignore */
          }
          continue;
        }

        const d = distanceMeters(
          latitude,
          longitude,
          task.latitude as number,
          task.longitude as number
        );
        const inside = d <= (task.radiusMeters as number);

        if (!inside) {
          insideRef.current.set(task.id, false);
          lastNudgeAtRef.current.delete(task.id);
          continue;
        }

        insideRef.current.set(task.id, true);

        if (mutedByDismiss.has(task.id)) {
          continue;
        }

        const timeOk =
          task.remindAt == null ||
          task.remindAt === "" ||
          now >= new Date(task.remindAt).getTime();
        if (!timeOk) continue;

        const lastNudge = lastNudgeAtRef.current.get(task.id);
        if (lastNudge != null && now - lastNudge < NUDGE_INTERVAL_MS) {
          continue;
        }

        try {
          const mode = await presentReminderForTask(task);
          if (mode === "web_fallback") {
            webFallbackBatch.push(task);
          }
          await api.nudgeTask(apiBase, accessToken, task.id);
          lastNudgeAtRef.current.set(task.id, Date.now());
        } catch {
          /* ignore */
        }
      }

      if (webFallbackBatch.length > 0) {
        playPinnedAlertSound();
        onWebInAppFallback?.(webFallbackBatch);
      }
    };

    const needsLocation = tasks.some(isPinTask);

    (async () => {
      if (Platform.OS !== "web") {
        await Notifications.requestPermissionsAsync();
      }

      if (cancelled) return;

      if (!needsLocation) {
        tickId = setInterval(() => {
          if (!cancelled) void runScan(0, 0);
        }, LOCATION_TICK_MS);
        await runScan(0, 0);
        return;
      }

      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status !== "granted" || cancelled) return;

      if (cancelled) return;

      try {
        const pos = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = pos.coords;
        lastCoordsRef.current = { lat: latitude, lon: longitude };
        await runScan(latitude, longitude);
      } catch {
        /* ignore */
      }

      if (cancelled) return;

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 1,
          timeInterval: 5000,
        },
        async (loc) => {
          const { latitude, longitude } = loc.coords;
          lastCoordsRef.current = { lat: latitude, lon: longitude };
          await runScan(latitude, longitude);
        }
      );

      tickId = setInterval(() => {
        const c = lastCoordsRef.current;
        if (c && !cancelled) void runScan(c.lat, c.lon);
      }, LOCATION_TICK_MS);
    })();

    return () => {
      cancelled = true;
      if (tickId != null) clearInterval(tickId);
      safeRemoveLocationSubscription();
    };
  }, [tasks, apiBase, accessToken, enabled, onWebInAppFallback, mutedByDismiss]);
}

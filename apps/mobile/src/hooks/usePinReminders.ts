import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as api from "../lib/api";
import { distanceMeters } from "../lib/geo";
import type { Task } from "../types/task";

function canUseBrowserNotifications(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    "Notification" in window
  );
}

/**
 * Web: `expo-notifications` does not show system banners reliably; use the Web Notifications API.
 * If permission denied, caller can show an in-app banner via `onWebInAppFallback`.
 * Native: keep using expo-notifications.
 */
async function showReminderNotification(
  task: Task,
  onWebInAppFallback?: (t: Task) => void
): Promise<void> {
  const body = `You're at: ${task.title}`;
  if (canUseBrowserNotifications()) {
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        new Notification("Pinned", { body, tag: task.id });
        return;
      }
      onWebInAppFallback?.(task);
    } catch {
      onWebInAppFallback?.(task);
    }
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Pinned",
      body,
      data: { taskId: task.id },
      ...(Platform.OS === "android"
        ? { android: { channelId: "reminders" } }
        : {}),
    },
    trigger: null,
  });
}

/**
 * When you enter a task's radius: local notification + POST /tasks/:id/nudge (syncs WebSocket).
 */
export function usePinReminders(
  tasks: Task[],
  apiBase: string,
  accessToken: string | null,
  enabled: boolean,
  onWebInAppFallback?: (task: Task) => void
) {
  const insideRef = useRef<Map<string, boolean>>(new Map());
  /** One notification per zone visit after time gate (if any). */
  const notifiedRef = useRef<Map<string, boolean>>(new Map());
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken) {
      insideRef.current.clear();
      notifiedRef.current.clear();
      subRef.current?.remove();
      subRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      const locPerm = await Location.requestForegroundPermissionsAsync();
      if (locPerm.status !== "granted" || cancelled) return;

      await Notifications.requestPermissionsAsync();

      if (cancelled) return;

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 25,
          timeInterval: 10000,
        },
        async (loc) => {
          const { latitude, longitude } = loc.coords;
          const now = Date.now();
          for (const task of tasks) {
            const d = distanceMeters(
              latitude,
              longitude,
              task.latitude,
              task.longitude
            );
            const inside = d <= task.radiusMeters;

            if (!inside) {
              insideRef.current.set(task.id, false);
              notifiedRef.current.delete(task.id);
              continue;
            }

            insideRef.current.set(task.id, true);

            const timeOk =
              task.remindAt == null ||
              task.remindAt === "" ||
              now >= new Date(task.remindAt).getTime();
            if (!timeOk) continue;
            if (notifiedRef.current.get(task.id)) continue;

            notifiedRef.current.set(task.id, true);
            try {
              await showReminderNotification(task, onWebInAppFallback);
              await api.nudgeTask(apiBase, accessToken, task.id);
            } catch {
              /* ignore */
            }
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [tasks, apiBase, accessToken, enabled, onWebInAppFallback]);
}

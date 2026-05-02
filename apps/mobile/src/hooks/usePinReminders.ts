import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as api from "../lib/api";
import { distanceMeters } from "../lib/geo";
import type { Task } from "../types/task";

/**
 * When you enter a task's radius: local notification + POST /tasks/:id/nudge (syncs WebSocket).
 */
export function usePinReminders(
  tasks: Task[],
  apiBase: string,
  accessToken: string | null,
  enabled: boolean
) {
  const insideRef = useRef<Map<string, boolean>>(new Map());
  const subRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    if (!enabled || !accessToken) {
      insideRef.current.clear();
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
          for (const task of tasks) {
            const d = distanceMeters(
              latitude,
              longitude,
              task.latitude,
              task.longitude
            );
            const inside = d <= task.radiusMeters;
            const wasInside = insideRef.current.get(task.id) ?? false;

            if (inside) {
              if (!wasInside) {
                insideRef.current.set(task.id, true);
                try {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: "Pinned",
                      body: `You're at: ${task.title}`,
                      data: { taskId: task.id },
                      ...(Platform.OS === "android"
                        ? { android: { channelId: "reminders" } }
                        : {}),
                    },
                    trigger: null,
                  });
                  await api.nudgeTask(apiBase, accessToken, task.id);
                } catch {
                  /* ignore */
                }
              } else {
                insideRef.current.set(task.id, true);
              }
            } else {
              insideRef.current.set(task.id, false);
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
  }, [tasks, apiBase, accessToken, enabled]);
}

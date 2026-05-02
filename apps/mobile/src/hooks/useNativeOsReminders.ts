import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { isPinTask } from "../lib/taskKind";
import { GEOFENCE_TASK_NAME } from "../native/registerGeofenceTask";
import type { Task } from "../types/task";

const SCHED_PREFIX = "pinned-os-time-";
/** iOS region monitoring works more reliably with a minimum radius (meters). */
const MIN_GEOFENCE_RADIUS_M = 100;
const MAX_GEOFENCE_REGIONS = 18;

/**
 * Syncs **native OS** local notifications:
 * - **Time-only tasks**: one-shot alert at `remindAt` (fires even if the app is in the background).
 * - **Map pins**: registers **geofence enter** alerts (native notification on boundary cross).
 */
export function useNativeOsReminders(
  tasks: Task[],
  accessToken: string | null
): void {
  const geofenceStartedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === "web" || !accessToken) return;

    let cancelled = false;

    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        await Notifications.requestPermissionsAsync();
      }
    })();

    (async () => {
      try {
        const scheduled =
          await Notifications.getAllScheduledNotificationsAsync();
        for (const req of scheduled) {
          if (req.identifier.startsWith(SCHED_PREFIX)) {
            await Notifications.cancelScheduledNotificationAsync(req.identifier);
          }
        }

        if (cancelled) return;

        const now = Date.now();
        for (const task of tasks) {
          if (isPinTask(task)) continue;
          if (!task.remindAt) continue;
          const at = new Date(task.remindAt).getTime();
          const deltaSec = Math.floor((at - now) / 1000);
          if (deltaSec < 2) continue;

          await Notifications.scheduleNotificationAsync({
            identifier: `${SCHED_PREFIX}${task.id}`,
            content: {
              title: "Pinned",
              body: `Reminder: ${task.title}`,
              data: { taskId: task.id, kind: "time_scheduled" },
              sound: true,
              ...(Platform.OS === "android"
                ? { android: { channelId: "reminders" } }
                : {}),
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: deltaSec,
              repeats: false,
            },
          });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tasks, accessToken]);

  useEffect(() => {
    if (Platform.OS === "web" || !accessToken) return;

    let cancelled = false;

    (async () => {
      try {
        const pinTasks = tasks.filter(isPinTask);
        const regions: Location.LocationRegion[] = pinTasks
          .slice(0, MAX_GEOFENCE_REGIONS)
          .map((t) => ({
            identifier: t.id,
            latitude: t.latitude as number,
            longitude: t.longitude as number,
            radius: Math.max(MIN_GEOFENCE_RADIUS_M, t.radiusMeters as number),
            notifyOnEnter: true,
            notifyOnExit: false,
          }));

        const started = await Location.hasStartedGeofencingAsync(
          GEOFENCE_TASK_NAME
        );
        if (started) {
          await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
        }
        geofenceStartedRef.current = false;

        if (cancelled || regions.length === 0) return;

        const fg = await Location.requestForegroundPermissionsAsync();
        if (fg.status !== "granted") return;

        await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions);
        geofenceStartedRef.current = true;
      } catch {
        /* simulator / permission / unsupported */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tasks, accessToken]);
}

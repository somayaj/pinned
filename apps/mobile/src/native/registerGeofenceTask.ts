/**
 * Must load before geofencing starts. Posts a **native OS notification** when the
 * user enters a saved pin region (works when the app is backgrounded).
 */
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as TaskManager from "expo-task-manager";

export const GEOFENCE_TASK_NAME = "PINNED_GEOFENCE_V1";

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (!data) return;

  const { eventType, region } = data as {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion;
  };

  if (eventType !== Location.GeofencingEventType.Enter) return;

  const taskId = region.identifier;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Pin it",
        body: "You've arrived at a saved pin. Open the app for details.",
        data: { taskId, kind: "geofence_enter" },
        sound: true,
        ...(Platform.OS === "android"
          ? { android: { channelId: "reminders" } }
          : {}),
      },
      trigger: null,
    });
  } catch {
    /* ignore */
  }
});

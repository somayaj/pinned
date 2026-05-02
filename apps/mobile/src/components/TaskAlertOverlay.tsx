import React from "react";
import { Image, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTasks } from "../context/TasksContext";

function nudgeIconUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/pinned-nudge-icon.svg`;
}

/**
 * Web: in-app banner when the API broadcasts `task_alert` over WebSocket — similar to
 * seeing a reminder inside a native app, not only the OS notification tray.
 */
export function TaskAlertOverlay() {
  const insets = useSafeAreaInsets();
  const { taskAlert, dismissTaskAlert } = useTasks();

  if (Platform.OS !== "web" || !taskAlert) {
    return null;
  }

  const { task, reason } = taskAlert;
  const subtitle =
    reason === "zone_entry"
      ? "You’re in range of this pin."
      : reason === "new_task"
        ? "New pin saved."
        : "";

  return (
    <View
      className="absolute left-0 right-0 z-[9999] px-4"
      style={{ top: insets.top + 8 }}
      pointerEvents="box-none"
    >
      <View className="flex-row gap-3 rounded-2xl border border-sky-200 bg-white p-4 shadow-xl">
        <View className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-sky-50">
          <Image
            source={{ uri: nudgeIconUri() }}
            className="h-full w-full"
            resizeMode="contain"
            accessibilityLabel="Pin reminder"
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold text-slate-900">
            {task.title}
          </Text>
          {subtitle ? (
            <Text className="mt-1 text-sm text-slate-600">{subtitle}</Text>
          ) : null}
          <Pressable
            onPress={dismissTaskAlert}
            className="mt-3 self-end rounded-lg bg-sky-600 px-4 py-2 active:bg-sky-700"
          >
            <Text className="text-sm font-semibold text-white">OK</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

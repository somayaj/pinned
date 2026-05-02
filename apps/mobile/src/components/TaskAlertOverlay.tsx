import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { NotificationBellIcon } from "./NotificationBellIcon";
import { PinItLogoIcon } from "./PinItLogoIcon";
import { useTasks } from "../context/TasksContext";
import { playPinnedAlertSound } from "../lib/alertSound";

/** Matches HomeScreen FAB: `bottom-8` (32) + h-14 (56). */
const FAB_BOTTOM = 32;
const FAB_SIZE = 56;
const GAP = 12;
const BELL_SIZE = 56;
/** Matches HomeScreen FAB `right-6` (24). */
const EDGE_RIGHT = 24;

/**
 * Web: bell chip bottom-right, above the + FAB. Task alerts slide up (Outlook-style) from the
 * same corner, above the chip.
 */
export function TaskAlertOverlay() {
  const { width: windowWidth } = useWindowDimensions();
  const {
    taskAlert,
    acknowledgeTaskAlert,
    dismissTaskAlertMuteReminders,
  } = useTasks();

  const slideY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  /** Bottom offset of bell — matches HomeScreen FAB stack (`bottom-8` + h-14 + gap). */
  const bellBottom = FAB_BOTTOM + FAB_SIZE + GAP;
  /** Outlook toast sits above the bell chip. */
  const toastBottom = bellBottom + BELL_SIZE + GAP;

  const slideDistance = 96;

  useEffect(() => {
    if (taskAlert) playPinnedAlertSound();
  }, [taskAlert?.task.id, taskAlert?.reason]);

  useEffect(() => {
    if (Platform.OS !== "web" || !taskAlert) {
      if (Platform.OS === "web") {
        slideY.setValue(slideDistance);
        opacity.setValue(0);
      }
      return;
    }

    slideY.setValue(slideDistance);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  }, [taskAlert?.task.id, taskAlert?.reason, slideDistance, slideY, opacity]);

  if (Platform.OS !== "web") {
    return null;
  }

  const subtitle =
    taskAlert == null
      ? ""
      : taskAlert.reason === "zone_entry"
        ? "You’re in range of this pin."
        : taskAlert.reason === "time_reminder"
          ? "Scheduled reminder."
          : taskAlert.reason === "new_task"
            ? taskAlert.task.latitude != null
              ? "New pin saved."
              : "New reminder saved."
            : "";

  const toastMaxW = Math.min(560, windowWidth - EDGE_RIGHT - 16);

  return (
    <View className="absolute inset-0 z-[9999]" pointerEvents="box-none">
      {/* Outlook-style task alert — slides up above the bell, anchored to the right */}
      {taskAlert ? (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            right: EDGE_RIGHT,
            bottom: toastBottom,
            width: toastMaxW,
            maxWidth: "100%",
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              opacity,
              transform: [{ translateY: slideY }],
            }}
          >
            <View className="overflow-hidden rounded border border-slate-300 bg-white shadow-xl shadow-slate-400/25">
              <View className="flex-row border-l-4 border-l-pin-600">
                <View className="justify-center border-r border-slate-200 bg-slate-50 px-3 py-2.5">
                  <PinItLogoIcon size={40} />
                </View>
                <View className="min-w-0 flex-1 flex-row flex-wrap items-center justify-between gap-3 py-2.5 pl-3 pr-2">
                  <View className="min-w-0 flex-1 py-0.5">
                    <Text
                      className="text-[15px] font-semibold text-slate-900"
                      numberOfLines={2}
                    >
                      {taskAlert.task.title}
                    </Text>
                    {subtitle ? (
                      <Text
                        className="mt-0.5 text-xs leading-snug text-slate-600"
                        numberOfLines={2}
                      >
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    <Pressable
                      onPress={dismissTaskAlertMuteReminders}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss and mute reminders until you tap Resume on this pin"
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 active:bg-slate-100"
                    >
                      <Text className="text-xs font-semibold text-slate-800">
                        Dismiss
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={acknowledgeTaskAlert}
                      accessibilityRole="button"
                      accessibilityLabel="OK, keep reminders on"
                      className="rounded bg-pin-600 px-3 py-1.5 active:bg-pin-700"
                    >
                      <Text className="text-xs font-semibold text-white">OK</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      ) : null}

      {/* Fixed bell — bottom-right, above + FAB (same horizontal line as FAB) */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: EDGE_RIGHT,
          bottom: bellBottom,
        }}
      >
        <View
          accessible
          accessibilityLabel="Notifications and reminders"
          accessibilityRole="image"
          className="items-center justify-center rounded-2xl border-2 border-pin-200 bg-white p-1.5 shadow-lg shadow-pin-200/40"
          style={{ width: BELL_SIZE, height: BELL_SIZE }}
        >
          <NotificationBellIcon size={30} color="#dc2626" />
        </View>
      </View>
    </View>
  );
}

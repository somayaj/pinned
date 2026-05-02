import React, { useEffect } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { NotificationBellIcon } from "./NotificationBellIcon";
import { PinItLogoIcon } from "./PinItLogoIcon";
import { useTasks } from "../context/TasksContext";
import { playPinnedAlertSound } from "../lib/alertSound";

/** Matches HomeScreen FAB: `bottom-8` (32) + `h-14` (56). */
const FAB_BOTTOM = 32;
const FAB_SIZE = 56;
const GAP = 12;
const BELL_SIZE = 56;
/** Matches HomeScreen FAB `right-6` (24). */
const EDGE_RIGHT = 24;

/** Toast starts this far below its rest position (px). */
const ENTRY_OFFSET = 88;
const DISMISS_DRAG_PX = 52;
const DISMISS_VELOCITY = 720;

const BELL_ROW_BOTTOM = FAB_BOTTOM + FAB_SIZE + GAP;
const TOAST_BOTTOM = BELL_ROW_BOTTOM + BELL_SIZE + GAP;

/** Above Home FAB (`z-[100]`, elevation 12) and nav chrome. */
const OVERLAY_Z = 100_000;
const ANDROID_OVERLAY_ELEVATION = 56;

/**
 * Web: bell chip bottom-right; task alerts slide up with spring + swipe-up to dismiss.
 */
export function TaskAlertOverlay() {
  const { width: windowWidth } = useWindowDimensions();
  const {
    taskAlert,
    acknowledgeTaskAlert,
    dismissTaskAlertMuteReminders,
  } = useTasks();

  const translateY = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== "web" || !taskAlert) {
      return;
    }
    playPinnedAlertSound();
    cancelAnimation(translateY);
    translateY.value = ENTRY_OFFSET;
    translateY.value = withSpring(0, {
      damping: 19,
      stiffness: 280,
      mass: 0.88,
    });
  }, [taskAlert?.task.id, taskAlert?.reason]);

  const dismissAsOk = () => {
    acknowledgeTaskAlert();
  };

  const pan = Gesture.Pan()
    .activeOffsetY([-12, 12])
    .failOffsetX([-28, 28])
    .onStart(() => {
      cancelAnimation(translateY);
      dragStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      const next = dragStartY.value + e.translationY;
      translateY.value = next > 0 ? next * 0.22 : next;
    })
    .onEnd((e) => {
      const shouldDismiss =
        translateY.value < -DISMISS_DRAG_PX ||
        e.velocityY < -DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(
          -260,
          { duration: 220 },
          (finished) => {
            if (finished) {
              runOnJS(dismissAsOk)();
            }
          }
        );
      } else {
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 320,
          mass: 0.85,
        });
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const o = interpolate(
      translateY.value,
      [-220, -80, 0, ENTRY_OFFSET],
      [0, 0.92, 1, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity: o,
      transform: [{ translateY: translateY.value }],
    };
  });

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

  const toastMaxW = Math.min(520, windowWidth - EDGE_RIGHT - 16);

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <View
        pointerEvents="box-none"
        style={[styles.dockSlot, { bottom: BELL_ROW_BOTTOM, zIndex: 1 }]}
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

      {taskAlert ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.dockSlot,
            {
              bottom: TOAST_BOTTOM,
              width: toastMaxW,
              maxWidth: "100%",
              zIndex: 10,
            },
          ]}
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={[{ width: "100%" }, cardStyle]}>
              <View className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-500/30">
                <View className="items-center pt-2 pb-1">
                  <View className="h-1 w-10 rounded-full bg-slate-300/90" />
                  <Text className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    Swipe up to dismiss
                  </Text>
                </View>
                <View className="flex-row border-l-[3px] border-l-pin-600">
                  <View className="justify-center border-r border-slate-100 bg-slate-50/90 px-3 py-2.5">
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
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 active:bg-slate-100"
                      >
                        <Text className="text-xs font-semibold text-slate-800">
                          Dismiss
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={acknowledgeTaskAlert}
                        accessibilityRole="button"
                        accessibilityLabel="OK, keep reminders on"
                        className="rounded-lg bg-pin-600 px-3 py-1.5 active:bg-pin-700"
                      >
                        <Text className="text-xs font-semibold text-white">OK</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>
          </GestureDetector>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: OVERLAY_Z,
    ...(Platform.OS === "android"
      ? { elevation: ANDROID_OVERLAY_ELEVATION }
      : {}),
  },
  dockSlot: {
    position: "absolute",
    right: EDGE_RIGHT,
  },
});

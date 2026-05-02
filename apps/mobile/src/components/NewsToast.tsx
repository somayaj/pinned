import React, { useEffect, useRef } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNews } from "../context/NewsContext";
import type { NewsHeadline } from "../lib/api";

const ABOVE_FAB_OFFSET = 32 + 56 + 14;
const EDGE_LEFT = 16;
const TOAST_MAX_W = 300;

const OVERLAY_Z = 100_000;
const ANDROID_OVERLAY_ELEVATION = 56;

function HeadlineRow({ h }: { h: NewsHeadline }) {
  return (
    <Pressable
      onPress={() => {
        if (h.link) void Linking.openURL(h.link);
      }}
      className="border-b border-slate-100 py-1.5 last:border-b-0 active:bg-slate-50"
    >
      <Text className="text-[11px] leading-snug text-slate-900" numberOfLines={3}>
        {h.title}
      </Text>
    </Pressable>
  );
}

export function NewsToast() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { lastAlert, dismissAlert } = useNews();
  const slideY = useRef(new Animated.Value(48)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const toastW = Math.min(TOAST_MAX_W, windowWidth - EDGE_LEFT * 2);

  useEffect(() => {
    if (!lastAlert) return;
    const hide = setTimeout(() => dismissAlert(), 30_000);
    return () => clearTimeout(hide);
  }, [lastAlert, dismissAlert]);

  useEffect(() => {
    if (!lastAlert) return;
    slideY.setValue(48);
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
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [lastAlert, opacity, slideY]);

  if (!lastAlert) {
    return null;
  }

  const hasCnn = lastAlert.cnn.length > 0;
  const hasCnbc = lastAlert.cnbc.length > 0;
  if (!hasCnn && !hasCnbc) {
    return null;
  }

  const timeLabel = new Date(lastAlert.fetchedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bottomLift =
    Math.max(insets.bottom, 8) + ABOVE_FAB_OFFSET + (Platform.OS === "web" ? 4 : 0);

  const subtitle =
    lastAlert.partial && lastAlert.warnings?.length
      ? `Partial · ${lastAlert.warnings.join("; ")}`
      : lastAlert.partial
        ? "Partial feed"
        : "CNN & CNBC RSS";

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: EDGE_LEFT,
          bottom: bottomLift,
          width: toastW,
          maxWidth: "100%",
          zIndex: 20,
          opacity,
          transform: [{ translateY: slideY }],
        }}
      >
        <View
          pointerEvents="auto"
          className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl shadow-slate-400/25"
        >
          <View className="flex-row items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-2.5 py-1.5">
            <View className="min-w-0 flex-1">
              <Text
                className="text-[11px] font-semibold leading-tight text-slate-800"
                numberOfLines={1}
              >
                Headlines · {timeLabel}
              </Text>
              <Text className="text-[9px] leading-tight text-slate-500" numberOfLines={2}>
                {subtitle}
              </Text>
            </View>
            <Pressable
              onPress={dismissAlert}
              accessibilityLabel="Dismiss headlines"
              hitSlop={8}
              className="h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white active:bg-slate-100"
            >
              <Text className="text-base font-semibold leading-none text-slate-600">×</Text>
            </Pressable>
          </View>
          <ScrollView
            className="px-2 py-1"
            nestedScrollEnabled
            style={{ maxHeight: 220 }}
          >
            {hasCnn ? (
              <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                CNN
              </Text>
            ) : null}
            {lastAlert.cnn.map((h, i) => (
              <HeadlineRow key={`cnn-${i}-${h.link}`} h={h} />
            ))}
            {hasCnn && hasCnbc ? <View className="my-1 border-t border-slate-100" /> : null}
            {hasCnbc ? (
              <Text className="mb-0.5 mt-1 text-[10px] font-bold uppercase tracking-wide text-blue-800">
                CNBC
              </Text>
            ) : null}
            {lastAlert.cnbc.map((h, i) => (
              <HeadlineRow key={`cnbc-${i}-${h.link}`} h={h} />
            ))}
          </ScrollView>
        </View>
      </Animated.View>
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
});

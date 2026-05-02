import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStocks } from "../context/StocksContext";

/** HomeScreen FAB: bottom-8 (32) + h-14 (56) + gap — sits above + button. */
const ABOVE_FAB_OFFSET = 32 + 56 + 14;
const EDGE_RIGHT = 16;
const TOAST_MAX_W = 280;

/** Above Home FAB (`z-[100]`, elevation) and task dock. */
const OVERLAY_Z = 100_000;
const ANDROID_OVERLAY_ELEVATION = 56;

function fmtPrice(n: number | null, currency: string): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${currency} ${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtChg(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}`;
}

function fmtPct(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/**
 * Non-blocking toast: slides up above the FAB, no modal or dimmed backdrop.
 */
export function StockQuoteAlert() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { lastAlert, dismissAlert } = useStocks();
  const slideY = useRef(new Animated.Value(48)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const toastW = Math.min(TOAST_MAX_W, windowWidth - EDGE_RIGHT * 2);

  useEffect(() => {
    if (!lastAlert) {
      return;
    }
    const hide = setTimeout(() => dismissAlert(), 25_000);
    return () => clearTimeout(hide);
  }, [lastAlert, dismissAlert]);

  useEffect(() => {
    if (!lastAlert) {
      return;
    }
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

  if (!lastAlert || lastAlert.quotes.length === 0) {
    return null;
  }

  const timeLabel = new Date(lastAlert.fetchedAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const bottomLift =
    Math.max(insets.bottom, 8) + ABOVE_FAB_OFFSET + (Platform.OS === "web" ? 4 : 0);

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: EDGE_RIGHT,
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
                Market · {timeLabel}
              </Text>
              <Text className="text-[9px] leading-tight text-slate-500" numberOfLines={1}>
                Yahoo Finance
              </Text>
            </View>
            <Pressable
              onPress={dismissAlert}
              accessibilityLabel="Dismiss market update"
              hitSlop={8}
              className="h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white active:bg-slate-100"
            >
              <Text className="text-base font-semibold leading-none text-slate-600">×</Text>
            </Pressable>
          </View>
          <ScrollView
            className="px-2 py-1"
            nestedScrollEnabled
            style={{ maxHeight: 160 }}
          >
            {lastAlert.quotes.map((q) => (
              <View
                key={q.symbol}
                className="flex-row items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0"
              >
                <View className="min-w-0 flex-1 pr-2">
                  <Text
                    className="text-[11px] font-bold leading-tight text-slate-900"
                    numberOfLines={1}
                  >
                    {q.symbol}
                  </Text>
                  {q.shortName ? (
                    <Text
                      className="text-[9px] leading-tight text-slate-500"
                      numberOfLines={1}
                    >
                      {q.shortName}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end">
                  <Text className="text-[11px] font-semibold leading-tight text-slate-900">
                    {fmtPrice(q.price, q.currency)}
                  </Text>
                  <Text
                    className={`text-[9px] font-medium leading-tight ${
                      (q.change ?? 0) >= 0 ? "text-emerald-700" : "text-red-600"
                    }`}
                  >
                    {fmtChg(q.change)} {fmtPct(q.changePercent)}
                  </Text>
                </View>
              </View>
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

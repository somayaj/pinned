import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStocks } from "../context/StocksContext";

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
 * Sliding info panel for Yahoo-backed stock quotes (web + native).
 */
export function StockQuoteAlert() {
  const insets = useSafeAreaInsets();
  const { lastAlert, dismissAlert } = useStocks();
  const slideY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

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
    slideY.setValue(120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 4,
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

  return (
    <View
      className="pointer-events-none absolute inset-0 z-[9990]"
      pointerEvents="box-none"
    >
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: Math.max(insets.bottom, 12) + (Platform.OS === "web" ? 8 : 0),
          paddingHorizontal: 12,
          opacity,
          transform: [{ translateY: slideY }],
        }}
      >
        <View
          pointerEvents="auto"
          className="max-h-80 overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <View className="flex-row items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
            <View>
              <Text className="text-xs font-semibold uppercase text-slate-500">
                Market update
              </Text>
              <Text className="text-xs text-slate-500">Yahoo Finance · {timeLabel}</Text>
            </View>
            <Pressable
              onPress={dismissAlert}
              accessibilityLabel="Dismiss stock update"
              className="rounded-lg bg-slate-200 px-3 py-1.5 active:bg-slate-300"
            >
              <Text className="text-xs font-semibold text-slate-800">Close</Text>
            </Pressable>
          </View>
          <ScrollView className="px-2 py-2" nestedScrollEnabled>
            {lastAlert.quotes.map((q) => (
              <View
                key={q.symbol}
                className="flex-row items-center justify-between border-b border-slate-100 py-2.5 pl-2 pr-2 last:border-b-0"
              >
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="text-sm font-bold text-slate-900">
                    {q.symbol}
                  </Text>
                  {q.shortName ? (
                    <Text className="text-xs text-slate-500" numberOfLines={1}>
                      {q.shortName}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end">
                  <Text className="text-sm font-semibold text-slate-900">
                    {fmtPrice(q.price, q.currency)}
                  </Text>
                  <Text
                    className={`text-xs font-medium ${
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

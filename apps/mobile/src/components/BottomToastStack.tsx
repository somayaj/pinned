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
import { useStocks } from "../context/StocksContext";
import type { NewsHeadline } from "../lib/api";

/** HomeScreen FAB: bottom-8 (32) + h-14 (56) + gap — sits above + button. */
const ABOVE_FAB_OFFSET = 32 + 56 + 14;
const H_INSET = 16;
const TOAST_MAX_W = 320;
const STACK_GAP = 12;

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

function NewsHeadlineRow({ h }: { h: NewsHeadline }) {
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

/**
 * Stocks + news toasts: centered above the FAB, vertical stack with gap when both show.
 */
export function BottomToastStack() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { lastAlert: stockAlert, dismissAlert: dismissStocks } = useStocks();
  const { lastAlert: newsAlert, dismissAlert: dismissNews } = useNews();

  const toastW = Math.min(TOAST_MAX_W, windowWidth - H_INSET * 2);

  const stockSlideY = useRef(new Animated.Value(48)).current;
  const stockOpacity = useRef(new Animated.Value(0)).current;
  const newsSlideY = useRef(new Animated.Value(48)).current;
  const newsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!stockAlert) return;
    const hide = setTimeout(() => dismissStocks(), 25_000);
    return () => clearTimeout(hide);
  }, [stockAlert, dismissStocks]);

  useEffect(() => {
    if (!stockAlert) return;
    stockSlideY.setValue(48);
    stockOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(stockSlideY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
      Animated.timing(stockOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [stockAlert, stockOpacity, stockSlideY]);

  useEffect(() => {
    if (!newsAlert) return;
    const hide = setTimeout(() => dismissNews(), 30_000);
    return () => clearTimeout(hide);
  }, [newsAlert, dismissNews]);

  useEffect(() => {
    if (!newsAlert) return;
    newsSlideY.setValue(48);
    newsOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(newsSlideY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 5,
      }),
      Animated.timing(newsOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [newsAlert, newsOpacity, newsSlideY]);

  const hasStocks = Boolean(stockAlert && stockAlert.quotes.length > 0);
  const hasNews = Boolean(
    newsAlert && (newsAlert.cnn.length > 0 || newsAlert.cnbc.length > 0)
  );

  if (!hasStocks && !hasNews) {
    return null;
  }

  const bottomLift =
    Math.max(insets.bottom, 8) + ABOVE_FAB_OFFSET + (Platform.OS === "web" ? 4 : 0);

  const stockTime =
    stockAlert &&
    new Date(stockAlert.fetchedAt).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const newsTime =
    newsAlert &&
    new Date(newsAlert.fetchedAt).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const newsSubtitle = newsAlert
    ? newsAlert.partial && newsAlert.warnings?.length
      ? `Partial · ${newsAlert.warnings.join("; ")}`
      : newsAlert.partial
        ? "Partial feed"
        : "CNN & CNBC RSS"
    : "";

  return (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      <View
        pointerEvents="box-none"
        style={[
          styles.stackColumn,
          {
            bottom: bottomLift,
            paddingHorizontal: H_INSET,
            gap: STACK_GAP,
          },
        ]}
      >
        {hasStocks ? (
          <Animated.View
            pointerEvents="box-none"
            style={{
              width: toastW,
              maxWidth: "100%",
              alignSelf: "center",
              opacity: stockOpacity,
              transform: [{ translateY: stockSlideY }],
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
                    Market · {stockTime}
                  </Text>
                  <Text
                    className="text-[9px] leading-tight text-slate-500"
                    numberOfLines={1}
                  >
                    Yahoo Finance
                  </Text>
                </View>
                <Pressable
                  onPress={dismissStocks}
                  accessibilityLabel="Dismiss market update"
                  hitSlop={8}
                  className="h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white active:bg-slate-100"
                >
                  <Text className="text-base font-semibold leading-none text-slate-600">
                    ×
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                className="px-2 py-1"
                nestedScrollEnabled
                style={{ maxHeight: 160 }}
              >
                {stockAlert!.quotes.map((q) => (
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
        ) : null}

        {hasNews && newsAlert ? (
          <Animated.View
            pointerEvents="box-none"
            style={{
              width: toastW,
              maxWidth: "100%",
              alignSelf: "center",
              opacity: newsOpacity,
              transform: [{ translateY: newsSlideY }],
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
                    Headlines · {newsTime}
                  </Text>
                  <Text
                    className="text-[9px] leading-tight text-slate-500"
                    numberOfLines={2}
                  >
                    {newsSubtitle}
                  </Text>
                </View>
                <Pressable
                  onPress={dismissNews}
                  accessibilityLabel="Dismiss headlines"
                  hitSlop={8}
                  className="h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white active:bg-slate-100"
                >
                  <Text className="text-base font-semibold leading-none text-slate-600">
                    ×
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                className="px-2 py-1"
                nestedScrollEnabled
                style={{ maxHeight: 220 }}
              >
                {newsAlert.cnn.length > 0 ? (
                  <Text className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                    CNN
                  </Text>
                ) : null}
                {newsAlert.cnn.map((h, i) => (
                  <NewsHeadlineRow key={`cnn-${i}-${h.link}`} h={h} />
                ))}
                {newsAlert.cnn.length > 0 && newsAlert.cnbc.length > 0 ? (
                  <View className="my-1 border-t border-slate-100" />
                ) : null}
                {newsAlert.cnbc.length > 0 ? (
                  <Text className="mb-0.5 mt-1 text-[10px] font-bold uppercase tracking-wide text-blue-800">
                    CNBC
                  </Text>
                ) : null}
                {newsAlert.cnbc.map((h, i) => (
                  <NewsHeadlineRow key={`cnbc-${i}-${h.link}`} h={h} />
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        ) : null}
      </View>
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
  stackColumn: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    flexDirection: "column-reverse",
  },
});

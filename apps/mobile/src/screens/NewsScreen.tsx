import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useNews } from "../context/NewsContext";
import { useTasks } from "../context/TasksContext";
import {
  fetchNewsHeadlines,
  putNewsSettings,
  type NewsHeadline,
} from "../lib/api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "News">;
};

/** Must match API `news_settings` check constraint. */
const NEWS_POLL_MINUTES = [0, 1, 3, 5, 10, 15, 30] as const;

function labelPollMinutes(m: number): string {
  if (m === 0) return "Off";
  return `${m} min`;
}

function HeadlineBlock({
  title,
  accentClass,
  items,
}: {
  title: string;
  accentClass: string;
  items: NewsHeadline[];
}) {
  if (items.length === 0) return null;
  return (
    <View className="mt-6">
      <Text className={`text-xs font-bold uppercase tracking-wide ${accentClass}`}>
        {title}
      </Text>
      <View className="mt-2 overflow-hidden rounded-xl border border-red-100 bg-white">
        {items.map((h, i) => (
          <Pressable
            key={`${h.link}-${i}`}
            onPress={() => {
              if (h.link) void Linking.openURL(h.link);
            }}
            className={`border-b border-red-50 px-3 py-3 last:border-b-0 active:bg-red-50/90`}
          >
            <Text className="text-sm leading-snug text-slate-900">{h.title}</Text>
            {h.pubDate ? (
              <Text className="mt-1 text-[10px] text-slate-400" numberOfLines={1}>
                {h.pubDate}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function NewsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const { apiBase } = useTasks();
  const {
    pollIntervalMinutes: ctxPoll,
    applyNewsSettingsSnapshot,
    refreshNewsSettings,
  } = useNews();
  const [pollMinutes, setPollMinutes] = useState(ctxPoll);
  const [saveBusy, setSaveBusy] = useState(false);

  useEffect(() => {
    setPollMinutes(ctxPoll);
  }, [ctxPoll]);

  const [cnn, setCnn] = useState<NewsHeadline[]>([]);
  const [cnbc, setCnbc] = useState<NewsHeadline[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [warnings, setWarnings] = useState<string[] | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const data = await fetchNewsHeadlines(apiBase, accessToken);
      setCnn(data.cnn);
      setCnbc(data.cnbc);
      setFetchedAt(data.fetchedAt);
      setPartial(Boolean(data.partial));
      setWarnings(data.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load headlines");
      setCnn([]);
      setCnbc([]);
      setFetchedAt(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accessToken, apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
    void refreshNewsSettings();
  }, [load, refreshNewsSettings]);

  const savePoll = useCallback(async () => {
    if (!accessToken) return;
    setSaveBusy(true);
    try {
      const saved = await putNewsSettings(apiBase, accessToken, {
        pollIntervalMinutes: pollMinutes,
      });
      applyNewsSettingsSnapshot(saved);
      await refreshNewsSettings();
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        "News",
        e instanceof Error ? e.message : "Could not save headline alert interval"
      );
    } finally {
      setSaveBusy(false);
    }
  }, [
    accessToken,
    apiBase,
    applyNewsSettingsSnapshot,
    navigation,
    pollMinutes,
    refreshNewsSettings,
  ]);

  const timeLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-red-50" edges={["bottom"]}>
      <View className="flex-row items-center border-b border-red-100 bg-red-50 px-2 py-2">
        <Pressable onPress={() => navigation.goBack()} className="px-2 py-2">
          <Text className="text-pin-600">Back</Text>
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold text-slate-900">
          News
        </Text>
        <View className="w-14" />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text className="text-sm text-slate-600">
          Top stories from CNN and CNBC (RSS). While the app is open, a headline card
          can slide up when the RSS digest changes, on the interval below (or turn
          alerts off).
        </Text>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Headline alerts
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {NEWS_POLL_MINUTES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setPollMinutes(m)}
              className={`rounded-full border px-3 py-2 ${
                pollMinutes === m
                  ? "border-pin-600 bg-pin-50"
                  : "border-red-100 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  pollMinutes === m ? "text-pin-900" : "text-slate-700"
                }`}
              >
                {labelPollMinutes(m)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => void savePoll()}
          disabled={saveBusy}
          className="mt-4 items-center rounded-xl bg-pin-600 py-3 active:bg-pin-700 disabled:opacity-50"
        >
          {saveBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-white">Save alert interval</Text>
          )}
        </Pressable>

        <Text className="mt-8 text-xs font-medium uppercase text-slate-500">
          Latest headlines
        </Text>
        {timeLabel ? (
          <Text className="mt-2 text-xs text-slate-500">Updated {timeLabel}</Text>
        ) : null}
        {partial && warnings?.length ? (
          <Text className="mt-1 text-xs text-amber-800">
            Partial: {warnings.join("; ")}
          </Text>
        ) : partial ? (
          <Text className="mt-1 text-xs text-amber-800">Partial feed</Text>
        ) : null}

        {loading ? (
          <View className="mt-10 items-center">
            <ActivityIndicator />
          </View>
        ) : error ? (
          <Text className="mt-6 text-sm text-red-600">{error}</Text>
        ) : (
          <>
            <HeadlineBlock title="CNN" accentClass="text-red-700" items={cnn} />
            <HeadlineBlock title="CNBC" accentClass="text-blue-800" items={cnbc} />
            {cnn.length === 0 && cnbc.length === 0 ? (
              <Text className="mt-6 text-sm text-slate-500">No headlines right now.</Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

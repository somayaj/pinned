import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { fetchNewsHeadlines, type NewsHeadline } from "../lib/api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "News">;
};

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
      <View className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.map((h, i) => (
          <Pressable
            key={`${h.link}-${i}`}
            onPress={() => {
              if (h.link) void Linking.openURL(h.link);
            }}
            className={`border-b border-slate-100 px-3 py-3 last:border-b-0 active:bg-slate-50`}
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
  }, [load]);

  const timeLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
      <View className="flex-row items-center border-b border-slate-200 bg-white px-2 py-2">
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
          can also slide up when feeds refresh.
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

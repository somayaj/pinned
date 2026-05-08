import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { useBuiltinJobs } from "../context/BuiltinJobsContext";
import {
  fetchBuiltinJobs,
  putBuiltinJobSettings,
  type BuiltinJobResult,
  type BuiltinJobSettingsResponse,
} from "../lib/api";

const POLL_MINUTES = [0, 1, 2, 3, 5, 10, 15, 30] as const;
const POSTED_WITHIN = [1, 3] as const;

function labelPollMinutes(m: number): string {
  if (m === 0) return "Off";
  return `${m} min`;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "BuiltinJobs">;
};

export function BuiltinJobsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const { apiBase } = useTasks();
  const { settings: ctxSettings, applySettingsSnapshot, refreshSettings } =
    useBuiltinJobs();

  const [pollMinutes, setPollMinutes] = useState(5);
  const [keywords, setKeywords] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [postedWithinDays, setPostedWithinDays] = useState<1 | 3>(1);
  const [busy, setBusy] = useState(false);

  const [debugMode, setDebugMode] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<BuiltinJobResult[]>([]);
  const [previewFetchedAt, setPreviewFetchedAt] = useState<string | null>(null);
  const [previewSourceUrl, setPreviewSourceUrl] = useState<string | null>(null);
  const [previewWarnings, setPreviewWarnings] = useState<string[] | null>(null);
  const [previewParsedCount, setPreviewParsedCount] = useState<number | null>(null);

  useEffect(() => {
    setPollMinutes(ctxSettings.pollIntervalMinutes ?? 5);
    setKeywords(ctxSettings.keywords ?? "");
    setRemoteOnly(Boolean(ctxSettings.remoteOnly));
    setPostedWithinDays((ctxSettings.postedWithinDays ?? 1) === 3 ? 3 : 1);
  }, [ctxSettings]);

  const loadPreview = useCallback(async () => {
    if (!accessToken) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const data = await fetchBuiltinJobs(apiBase, accessToken);
      setPreviewItems(data.items ?? []);
      setPreviewFetchedAt(data.fetchedAt ?? null);
      setPreviewSourceUrl(data.sourceUrl ?? null);
      setPreviewWarnings(data.warnings ?? null);
      setPreviewParsedCount(typeof data.parsedCount === "number" ? data.parsedCount : null);
    } catch (e) {
      setPreviewItems([]);
      setPreviewFetchedAt(null);
      setPreviewSourceUrl(null);
      setPreviewWarnings(null);
      setPreviewParsedCount(null);
      setPreviewError(e instanceof Error ? e.message : "Could not load jobs");
    } finally {
      setPreviewLoading(false);
    }
  }, [accessToken, apiBase]);

  const settingsToSave: BuiltinJobSettingsResponse = useMemo(
    () => ({
      pollIntervalMinutes: pollMinutes,
      keywords,
      remoteOnly,
      postedWithinDays,
    }),
    [pollMinutes, keywords, remoteOnly, postedWithinDays]
  );

  const save = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const saved = await putBuiltinJobSettings(apiBase, accessToken, settingsToSave);
      applySettingsSnapshot(saved);
      await refreshSettings();
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        "BuiltIn Jobs",
        e instanceof Error ? e.message : "Could not save job search settings"
      );
    } finally {
      setBusy(false);
    }
  }, [
    accessToken,
    apiBase,
    applySettingsSnapshot,
    navigation,
    refreshSettings,
    settingsToSave,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={["bottom"]}>
      <View className="flex-row items-center border-b border-slate-200 bg-slate-100 px-2 py-2">
        <Pressable onPress={() => navigation.goBack()} className="px-2 py-2">
          <Text className="text-pin-600">Back</Text>
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold text-slate-900">
          BuiltIn Jobs
        </Text>
        <View className="w-14" />
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-slate-600">
          While the app is open, a jobs card can slide up when the results change on
          the interval you choose. This uses BuiltIn page scraping, so results may be
          partial if BuiltIn changes.
        </Text>
        <Text className="mt-2 text-[10px] text-slate-400" numberOfLines={1}>
          API: {apiBase}
        </Text>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Polling
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {POLL_MINUTES.map((m) => (
            <Pressable
              key={m}
              onPress={() => setPollMinutes(m)}
              className={`rounded-full border px-3 py-2 ${
                pollMinutes === m ? "border-pin-600 bg-pin-50" : "border-slate-200 bg-white"
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

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Keywords
        </Text>
        <TextInput
          value={keywords}
          onChangeText={setKeywords}
          placeholder='e.g. "java spring backend"'
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
        />

        <View className="mt-4 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-sm font-semibold text-slate-900">Remote only</Text>
            <Text className="mt-1 text-xs text-slate-500">
              Prefer results labeled remote.
            </Text>
          </View>
          <Pressable
            onPress={() => setRemoteOnly((v) => !v)}
            className={`rounded-full border px-3 py-2 ${
              remoteOnly ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-slate-50"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                remoteOnly ? "text-emerald-900" : "text-slate-700"
              }`}
            >
              {remoteOnly ? "On" : "Off"}
            </Text>
          </Pressable>
        </View>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Posted within
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {POSTED_WITHIN.map((d) => (
            <Pressable
              key={d}
              onPress={() => setPostedWithinDays(d)}
              className={`rounded-full border px-3 py-2 ${
                postedWithinDays === d
                  ? "border-pin-600 bg-pin-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  postedWithinDays === d ? "text-pin-900" : "text-slate-700"
                }`}
              >
                {d === 1 ? "24 hours" : "3 days"}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => void save()}
          disabled={busy}
          className="mt-8 items-center rounded-xl bg-pin-600 py-4 active:bg-pin-700 disabled:opacity-50"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-white">Save job search</Text>
          )}
        </Pressable>

        <View className="mt-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <Pressable
            onPress={() => setDebugMode((v) => !v)}
            className="flex-row items-center justify-between px-4 py-3 active:bg-slate-50"
          >
            <View className="min-w-0 flex-1 pr-3">
              <Text className="text-sm font-semibold text-slate-900">Debug mode</Text>
              <Text className="mt-1 text-xs text-slate-500">
                Show the preview section for troubleshooting.
              </Text>
            </View>
            <Text className="text-sm font-semibold text-slate-700">
              {debugMode ? "On" : "Off"}
            </Text>
          </Pressable>

          {debugMode ? (
            <View className="border-t border-slate-200 px-4 py-4">
              <Text className="text-xs font-medium uppercase text-slate-500">
                Preview jobs (debug)
              </Text>
              <Text className="mt-1 text-sm text-slate-600">
                This helps confirm the API is returning items for the popup.
              </Text>
              <Pressable
                onPress={() => void loadPreview()}
                disabled={previewLoading}
                className="mt-3 items-center rounded-xl border border-slate-200 bg-white py-3 active:bg-slate-100 disabled:opacity-50"
              >
                {previewLoading ? (
                  <ActivityIndicator />
                ) : (
                  <Text className="font-semibold text-slate-800">Refresh preview</Text>
                )}
              </Pressable>
              {previewError ? (
                <Text className="mt-2 text-sm text-red-600">{previewError}</Text>
              ) : null}
              {previewFetchedAt ? (
                <Text className="mt-2 text-xs text-slate-500" numberOfLines={1}>
                  Updated{" "}
                  {new Date(previewFetchedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </Text>
              ) : null}
              {previewSourceUrl ? (
                <Pressable
                  onPress={() => void Linking.openURL(previewSourceUrl)}
                  className="mt-1"
                >
                  <Text className="text-[11px] text-slate-500" numberOfLines={2}>
                    Source: {previewSourceUrl}
                  </Text>
                </Pressable>
              ) : null}
              {previewParsedCount != null ? (
                <Text className="mt-1 text-[11px] text-slate-500" numberOfLines={1}>
                  Parsed: {previewParsedCount}
                </Text>
              ) : null}
              {previewWarnings?.length ? (
                <Text className="mt-1 text-[11px] text-amber-800" numberOfLines={3}>
                  Warnings: {previewWarnings.join("; ")}
                </Text>
              ) : null}
              {previewItems.length === 0 && !previewLoading && !previewError ? (
                <Text className="mt-2 text-sm text-slate-500">No items returned.</Text>
              ) : null}
              {previewItems.length > 0 ? (
                <View className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {previewItems.slice(0, 10).map((j) => (
                    <Pressable
                      key={j.id || j.url}
                      onPress={() => {
                        if (j.url) void Linking.openURL(j.url);
                      }}
                      className="border-b border-slate-100 px-3 py-3 last:border-b-0 active:bg-slate-100"
                    >
                      <Text
                        className="text-sm font-semibold text-slate-900"
                        numberOfLines={2}
                      >
                        {j.title}
                      </Text>
                      <Text className="mt-1 text-[11px] text-slate-500" numberOfLines={2}>
                        {j.company}
                        {j.location ? ` · ${j.location}` : ""}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}


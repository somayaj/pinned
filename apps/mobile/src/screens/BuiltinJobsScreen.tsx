import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  putBuiltinJobSettings,
  type BuiltinJobSettingsResponse,
} from "../lib/api";

const POLL_MINUTES = [0, 1, 2, 3, 5, 10, 15, 30] as const;
const POSTED_WITHIN_DAYS = [10, 20, 50, 100] as const;

function labelPollMinutes(m: number): string {
  if (m === 0) return "Off";
  return `${m} min`;
}

function parseCsvLines(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function joinCsv(list: string[]): string {
  return list.join(", ");
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
  const [locationsCsv, setLocationsCsv] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [postedWithinDays, setPostedWithinDays] = useState<number>(7);
  const [seniorityCsv, setSeniorityCsv] = useState("");
  const [jobTypeCsv, setJobTypeCsv] = useState("");
  const [companyAllowCsv, setCompanyAllowCsv] = useState("");
  const [companyDenyCsv, setCompanyDenyCsv] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPollMinutes(ctxSettings.pollIntervalMinutes ?? 5);
    setKeywords(ctxSettings.keywords ?? "");
    setLocationsCsv(joinCsv(ctxSettings.locations ?? []));
    setRemoteOnly(Boolean(ctxSettings.remoteOnly));
    setPostedWithinDays(ctxSettings.postedWithinDays ?? 7);
    setSeniorityCsv(joinCsv(ctxSettings.seniority ?? []));
    setJobTypeCsv(joinCsv(ctxSettings.jobType ?? []));
    setCompanyAllowCsv(joinCsv(ctxSettings.companyAllowlist ?? []));
    setCompanyDenyCsv(joinCsv(ctxSettings.companyDenylist ?? []));
  }, [ctxSettings]);

  const settingsToSave: BuiltinJobSettingsResponse = useMemo(
    () => ({
      pollIntervalMinutes: pollMinutes,
      keywords,
      locations: parseCsvLines(locationsCsv),
      remoteOnly,
      postedWithinDays,
      seniority: parseCsvLines(seniorityCsv),
      jobType: parseCsvLines(jobTypeCsv),
      companyAllowlist: parseCsvLines(companyAllowCsv),
      companyDenylist: parseCsvLines(companyDenyCsv),
    }),
    [
      pollMinutes,
      keywords,
      locationsCsv,
      remoteOnly,
      postedWithinDays,
      seniorityCsv,
      jobTypeCsv,
      companyAllowCsv,
      companyDenyCsv,
    ]
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

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Locations (comma-separated)
        </Text>
        <TextInput
          value={locationsCsv}
          onChangeText={setLocationsCsv}
          placeholder='e.g. "New York, NY, Austin, TX"'
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
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
          {POSTED_WITHIN_DAYS.map((d) => (
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
                {`${d} days`}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Seniority (comma-separated, optional)
        </Text>
        <TextInput
          value={seniorityCsv}
          onChangeText={setSeniorityCsv}
          placeholder='e.g. "Senior, Staff"'
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          autoCorrect={false}
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Job type (comma-separated, optional)
        </Text>
        <TextInput
          value={jobTypeCsv}
          onChangeText={setJobTypeCsv}
          placeholder='e.g. "Full-time, Contract"'
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          autoCorrect={false}
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Company allowlist (comma-separated, optional)
        </Text>
        <TextInput
          value={companyAllowCsv}
          onChangeText={setCompanyAllowCsv}
          placeholder='e.g. "Stripe, Airbnb"'
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          autoCorrect={false}
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Company denylist (comma-separated, optional)
        </Text>
        <TextInput
          value={companyDenyCsv}
          onChangeText={setCompanyDenyCsv}
          placeholder='e.g. "Acme Corp"'
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          autoCorrect={false}
          className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
        />

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
      </ScrollView>
    </SafeAreaView>
  );
}


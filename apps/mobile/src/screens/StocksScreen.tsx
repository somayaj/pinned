import React, { useCallback, useEffect, useState } from "react";
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
import { useAuth } from "../context/AuthContext";
import { useStocks } from "../context/StocksContext";
import { putStockWatchlist } from "../lib/api";
import { useTasks } from "../context/TasksContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

const INTERVALS = [1, 2, 3, 5, 10, 15, 30, 60] as const;
const MAX_TICKERS = 10;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Stocks">;
};

export function StocksScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const { apiBase } = useTasks();
  const {
    refreshWatchlist,
    applyWatchlistSnapshot,
    symbols: ctxSymbols,
    pollIntervalMinutes: ctxPoll,
  } = useStocks();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [pollMinutes, setPollMinutes] = useState(5);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSymbols(ctxSymbols);
    setPollMinutes(ctxPoll);
  }, [ctxSymbols, ctxPoll]);

  const save = useCallback(async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const saved = await putStockWatchlist(apiBase, accessToken, {
        symbols,
        pollIntervalMinutes: pollMinutes,
      });
      applyWatchlistSnapshot(saved);
      await refreshWatchlist();
      navigation.goBack();
    } catch (e) {
      Alert.alert(
        "Stocks",
        e instanceof Error ? e.message : "Could not save watchlist"
      );
    } finally {
      setBusy(false);
    }
  }, [
    accessToken,
    apiBase,
    applyWatchlistSnapshot,
    navigation,
    pollMinutes,
    refreshWatchlist,
    symbols,
  ]);

  const addTicker = () => {
    const t = draft.trim().toUpperCase();
    if (!t) return;
    if (symbols.length >= MAX_TICKERS) {
      Alert.alert("Stocks", `You can track up to ${MAX_TICKERS} tickers.`);
      return;
    }
    if (symbols.includes(t)) {
      setDraft("");
      return;
    }
    setSymbols((s) => [...s, t]);
    setDraft("");
  };

  const removeTicker = (sym: string) => {
    setSymbols((s) => s.filter((x) => x !== sym));
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["bottom"]}>
      <View className="flex-row items-center border-b border-slate-200 bg-white px-2 py-2">
        <Pressable onPress={() => navigation.goBack()} className="px-2 py-2">
          <Text className="text-pin-600">Back</Text>
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold text-slate-900">
          Stocks
        </Text>
        <View className="w-14" />
      </View>

      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-slate-600">
          Add up to {MAX_TICKERS} tickers. Prices refresh from Yahoo Finance on the
          interval you choose (as often as every minute; default 5 minutes). An info
          panel slides up with each
          update while the app is open.
        </Text>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          New ticker
        </Text>
        <View className="mt-2 flex-row gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. AAPL"
            placeholderTextColor="#94a3b8"
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={addTicker}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900"
          />
          <Pressable
            onPress={addTicker}
            className="justify-center rounded-xl bg-pin-600 px-4 active:bg-pin-700"
          >
            <Text className="font-semibold text-white">Add</Text>
          </Pressable>
        </View>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Watchlist ({symbols.length}/{MAX_TICKERS})
        </Text>
        {symbols.length === 0 ? (
          <Text className="mt-2 text-sm text-slate-500">None yet.</Text>
        ) : (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {symbols.map((s) => (
              <Pressable
                key={s}
                onPress={() => removeTicker(s)}
                className="flex-row items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 active:bg-slate-100"
              >
                <Text className="text-sm font-semibold text-slate-900">{s}</Text>
                <Text className="text-xs text-slate-400">✕</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Update every
        </Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {INTERVALS.map((m) => (
            <Pressable
              key={m}
              onPress={() => setPollMinutes(m)}
              className={`rounded-full border px-3 py-2 ${
                pollMinutes === m
                  ? "border-pin-600 bg-pin-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  pollMinutes === m ? "text-pin-900" : "text-slate-700"
                }`}
              >
                {m} min
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
            <Text className="font-semibold text-white">Save watchlist</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

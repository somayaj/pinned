import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { formatDistance, distanceMeters } from "../lib/geo";
import { usePinReminders } from "../hooks/usePinReminders";
import * as Location from "expo-location";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Task } from "../types/task";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

export function HomeScreen({ navigation }: Props) {
  const { user, accessToken, signOut } = useAuth();
  const { tasks, apiBase, wsStatus, loading, error, refresh, removeTask } =
    useTasks();
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [remindersOn, setRemindersOn] = useState(true);

  usePinReminders(tasks, apiBase, accessToken, remindersOn);

  const updateLocation = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    setLoc({
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
    });
  }, []);

  React.useEffect(() => {
    void updateLocation();
  }, [updateLocation, tasks.length]);

  const distFor = (t: Task) => {
    if (!loc) return null;
    return distanceMeters(loc.lat, loc.lon, t.latitude, t.longitude);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="border-b border-slate-200 bg-white px-4 pb-3 pt-2">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-lg font-semibold text-slate-900">Pinned</Text>
            <Text className="text-xs text-slate-500" numberOfLines={1}>
              {user?.name ?? user?.email ?? "Signed in"}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2 w-2 rounded-full ${
                wsStatus === "on" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <Pressable
              onPress={() => navigation.navigate("Settings")}
              className="rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
            >
              <Text className="text-sm font-medium text-slate-700">
                Settings
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void signOut()}
              className="rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
            >
              <Text className="text-sm font-medium text-slate-700">Out</Text>
            </Pressable>
          </View>
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-xs text-slate-500">
            Live {wsStatus === "on" ? "on" : "connecting…"}
          </Text>
          <Pressable
            onPress={() => setRemindersOn((v) => !v)}
            className="rounded-md bg-sky-50 px-2 py-1"
          >
            <Text className="text-xs font-medium text-sky-800">
              Reminders {remindersOn ? "on" : "off"}
            </Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text className="mx-4 mt-2 text-sm text-red-600">{error}</Text>
      ) : null}

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
          />
        }
        contentContainerClassName="px-4 py-4"
        ListEmptyComponent={
          <Text className="mt-8 text-center text-slate-500">
            No pins yet. Add one to get reminded when you arrive.
          </Text>
        }
        renderItem={({ item }) => {
          const d = distFor(item);
          return (
            <View className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Text className="text-base font-semibold text-slate-900">
                {item.title}
              </Text>
              <Text className="mt-1 text-xs text-slate-500">
                Radius {item.radiusMeters} m
                {d != null ? ` · ${formatDistance(d)} away` : ""}
              </Text>
              <Pressable
                onPress={() => void removeTask(item.id)}
                className="mt-3 self-start rounded-lg bg-red-50 px-3 py-2 active:bg-red-100"
              >
                <Text className="text-sm font-medium text-red-700">
                  Remove
                </Text>
              </Pressable>
            </View>
          );
        }}
      />

      <Pressable
        onPress={() => navigation.navigate("AddPin")}
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-sky-600 shadow-lg active:bg-sky-700"
      >
        <Text className="text-2xl font-light text-white">+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

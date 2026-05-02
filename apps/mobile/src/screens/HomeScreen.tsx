import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { postWebPushTest } from "../lib/api";
import { useTasks } from "../context/TasksContext";
import { formatDistance, distanceMeters } from "../lib/geo";
import { usePinReminders } from "../hooks/usePinReminders";
import {
  hasWebPushSubscription,
  subscribeToWebPush,
  unsubscribeFromWebPush,
} from "../lib/webPush";
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
  const [inAppBanner, setInAppBanner] = useState<Task | null>(null);
  const [webPushOn, setWebPushOn] = useState(false);
  const [webPushBusy, setWebPushBusy] = useState(false);

  const onWebInAppFallback = useCallback((task: Task) => {
    setInAppBanner(task);
  }, []);

  usePinReminders(tasks, apiBase, accessToken, remindersOn, onWebInAppFallback);

  React.useEffect(() => {
    if (Platform.OS !== "web" || !accessToken) return;
    void hasWebPushSubscription().then(setWebPushOn);
  }, [accessToken]);

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

      {inAppBanner ? (
        <View className="mx-4 mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Text className="text-base font-semibold text-amber-950">
            You&apos;re at: {inAppBanner.title}
          </Text>
          <Text className="mt-1 text-xs text-amber-900/90">
            Browser notifications are blocked or unavailable. Allow notifications
            for this site in the address bar to get alerts, or keep this tab open.
          </Text>
          <Pressable
            onPress={() => setInAppBanner(null)}
            className="mt-2 self-end rounded-lg bg-amber-100 px-3 py-1.5 active:bg-amber-200"
          >
            <Text className="text-sm font-medium text-amber-950">Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      {Platform.OS === "web" && accessToken ? (
        <View className="mx-4 mt-3 rounded-xl border border-slate-200 bg-white p-3">
          <Text className="text-xs font-medium uppercase text-slate-500">
            Background browser alerts
          </Text>
          <Text className="mt-1 text-xs text-slate-600">
            Pushes are sent when the server receives a location “nudge” (you entered
            the pin radius with Reminders on). Use “Send test” to verify VAPID +
            this browser without moving. Railway must set WEB_PUSH_* env vars.
          </Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Pressable
              disabled={webPushBusy}
              onPress={() => {
                if (!accessToken) return;
                setWebPushBusy(true);
                void (async () => {
                  try {
                    if (webPushOn) {
                      await unsubscribeFromWebPush(accessToken);
                      setWebPushOn(false);
                    } else {
                      const r = await subscribeToWebPush(accessToken);
                      if (r.ok) {
                        setWebPushOn(true);
                      } else if (r.error === "no_server_keys") {
                        Alert.alert(
                          "Web Push",
                          "Server is missing WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY (check Railway)."
                        );
                      } else if (r.error === "denied") {
                        Alert.alert(
                          "Notifications",
                          "Allow notifications for this site to enable push."
                        );
                      }
                    }
                  } finally {
                    setWebPushBusy(false);
                  }
                })();
              }}
              className="rounded-lg bg-sky-600 px-3 py-2 active:bg-sky-700 disabled:opacity-60"
            >
              {webPushBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  {webPushOn ? "Turn off push" : "Enable push"}
                </Text>
              )}
            </Pressable>
            <Text className="self-center text-xs text-slate-500">
              {webPushOn ? "On" : "Off"}
            </Text>
            {webPushOn ? (
              <Pressable
                disabled={webPushBusy}
                onPress={() => {
                  if (!accessToken) return;
                  setWebPushBusy(true);
                  void (async () => {
                    try {
                      const r = await postWebPushTest(apiBase, accessToken);
                      if (!r.vapidConfigured) {
                        Alert.alert(
                          "Web Push",
                          "Server has no VAPID keys. Set WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT on Railway and redeploy."
                        );
                      } else if (r.subscriptions === 0) {
                        Alert.alert(
                          "Web Push",
                          "No subscription stored. Turn push off and Enable again."
                        );
                      } else {
                        Alert.alert(
                          "Web Push test",
                          `Sent: ${r.sent}, failed: ${r.failed}, subscriptions: ${r.subscriptions}. Check for a system notification (and OS Focus / Do Not Disturb).`
                        );
                      }
                    } catch (e) {
                      Alert.alert(
                        "Web Push",
                        e instanceof Error ? e.message : "Test failed"
                      );
                    } finally {
                      setWebPushBusy(false);
                    }
                  })();
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 active:bg-slate-50 disabled:opacity-60"
              >
                <Text className="text-sm font-medium text-slate-800">
                  Send test
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
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
                {item.remindAt != null && item.remindAt !== ""
                  ? ` · After ${new Date(item.remindAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}`
                  : ""}
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

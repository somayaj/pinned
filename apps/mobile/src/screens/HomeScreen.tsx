import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlaceMarkerIcon } from "../components/PlaceMarkerIcon";
import { PinItLogoIcon } from "../components/PinItLogoIcon";
import { TaskCard } from "../components/TaskCard";
import { useAuth } from "../context/AuthContext";
import { fetchTasks } from "../lib/api";
import { useTasks } from "../context/TasksContext";
import { usePinReminders } from "../hooks/usePinReminders";
import * as Location from "expo-location";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import type { Task } from "../types/task";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Home">;
};

/** What to show in the main list: everything, pins whose zone contains you, or pin centers near you. */
type ListScope = "all" | "inZone" | "nearCenters";

/** Header mark — map + pin + task (inline SVG, all platforms). */
function PinItLogoMark() {
  return (
    <View
      className="h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm shadow-pin-200/40"
      accessibilityLabel="PIN it — map, pin, and tasks"
      accessibilityRole="image"
    >
      <PinItLogoIcon size={44} />
    </View>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { user, accessToken, signOut } = useAuth();
  const {
    tasks,
    locations,
    apiBase,
    wsStatus,
    loading,
    error,
    refresh,
    removeTask,
    muteRemindersForTask,
    resumeRemindersForTask,
    reminderMutedTaskIds,
  } = useTasks();

  const timeOnlyTasks = tasks.filter(
    (t) => t.latitude == null && t.longitude == null
  );
  const legacyPinTasks = tasks.filter(
    (t) =>
      !t.locationId &&
      t.latitude != null &&
      t.longitude != null &&
      t.radiusMeters != null
  );
  const taskCountForLocation = (id: string) =>
    tasks.filter((t) => t.locationId === id).length;
  const [loc, setLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [remindersOn, setRemindersOn] = useState(true);
  const [inAppBanner, setInAppBanner] = useState<Task[] | null>(null);
  const [listScope, setListScope] = useState<ListScope>("all");
  const [scopeTasks, setScopeTasks] = useState<Task[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  const onWebInAppFallback = useCallback((batch: Task[]) => {
    setInAppBanner(batch.length > 0 ? batch : null);
  }, []);

  usePinReminders(tasks, apiBase, accessToken, remindersOn, onWebInAppFallback);

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

  const loadScopedList = useCallback(async () => {
    if (!accessToken || listScope === "all") return;
    setScopeLoading(true);
    setScopeError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setScopeError("Turn on location to filter your list by where you are.");
        setScopeTasks([]);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      if (listScope === "inZone") {
        const list = await fetchTasks(apiBase, accessToken, {
          containsLat: lat,
          containsLon: lon,
        });
        setScopeTasks(list);
      } else {
        const list = await fetchTasks(apiBase, accessToken, {
          centerLat: lat,
          centerLon: lon,
          centerRadiusMeters: 200,
        });
        setScopeTasks(list);
      }
      setLoc({ lat, lon });
    } catch (e) {
      setScopeError(e instanceof Error ? e.message : "Could not load list");
      setScopeTasks([]);
    } finally {
      setScopeLoading(false);
    }
  }, [accessToken, apiBase, listScope]);

  React.useEffect(() => {
    if (listScope === "all") {
      setScopeError(null);
      return;
    }
    setScopeTasks([]);
    void loadScopedList();
  }, [listScope, loadScopedList]);

  const displayedTasks = listScope === "all" ? tasks : scopeTasks;
  const listBusy = listScope === "all" ? loading : scopeLoading;

  const onRefresh = useCallback(() => {
    if (listScope === "all") {
      void refresh();
    } else {
      void loadScopedList();
      void refresh();
    }
  }, [listScope, loadScopedList, refresh]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={["top"]}>
      <View className="border-b border-slate-100 bg-red-50 px-4 pb-4 pt-3">
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1 flex-row items-center gap-3 pr-2">
            <PinItLogoMark />
            <View className="min-w-0 flex-1">
              <Text
                className="text-2xl font-bold tracking-tight"
                accessibilityRole="header"
              >
                <Text className="text-red-600">Pin</Text>
                <Text className="text-slate-900">It</Text>
              </Text>
              <View className="mt-1.5 h-1 w-9 rounded-full bg-red-500" />
              <Text
                className="mt-2 text-xs font-medium text-slate-500"
                numberOfLines={1}
              >
                {user?.name ?? user?.email ?? "Signed in"}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            <View
              className={`h-2 w-2 rounded-full ${
                wsStatus === "on" ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <Pressable
              onPress={() => navigation.navigate("Stocks")}
              className="rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
            >
              <Text className="text-sm font-medium text-slate-700">Stocks</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("News")}
              className="rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
            >
              <Text className="text-sm font-medium text-slate-700">News</Text>
            </Pressable>
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
            className="rounded-md bg-red-100/80 px-2 py-1"
          >
            <Text className="text-xs font-medium text-red-900">
              Reminders {remindersOn ? "on" : "off"}
            </Text>
          </Pressable>
        </View>

        <View className="mt-3 flex-row flex-wrap gap-2">
          {(
            [
              ["all", "All", "Every reminder"],
              ["inZone", "Cover me", "Pins whose zone you’re inside"],
              ["nearCenters", "Near me", "Pin centers within ~200 m"],
            ] as const
          ).map(([key, label, hint]) => (
            <Pressable
              key={key}
              onPress={() => setListScope(key)}
              accessibilityHint={hint}
              className={`rounded-full border px-3 py-1.5 ${
                listScope === key
                  ? "border-red-600 bg-red-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  listScope === key ? "text-red-950" : "text-slate-700"
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {listScope !== "all" ? (
          <Text className="mt-2 text-xs leading-snug text-slate-500">
            {listScope === "inZone"
              ? "Map pins only: you’re inside the circle for these reminders."
              : "Map pins only: saved centers close to your current position."}
          </Text>
        ) : null}
        {scopeError && listScope !== "all" ? (
          <Text className="mt-2 text-xs text-amber-800">{scopeError}</Text>
        ) : null}
      </View>

      {error ? (
        <Text className="mx-4 mt-2 text-sm text-red-600">{error}</Text>
      ) : null}

      {inAppBanner && inAppBanner.length > 0 ? (
        <View className="mx-4 mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Text className="text-base font-semibold text-amber-950">
            You&apos;re at:{" "}
            {inAppBanner.map((t) => t.title).join(" · ")}
          </Text>
          <Text className="mt-1 text-xs text-amber-900/90">
            Browser notifications are blocked or unavailable. Allow notifications
            for this site in the address bar to get alerts, or keep this tab open.
          </Text>
          <View className="mt-2 flex-row flex-wrap justify-end gap-2">
            <Pressable
              onPress={() => {
                if (inAppBanner) {
                  for (const t of inAppBanner) muteRemindersForTask(t.id);
                }
                setInAppBanner(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Dismiss and mute reminders until you tap Resume on this pin"
              className="rounded-lg border border-amber-300/80 bg-white px-3 py-1.5 active:bg-amber-100/80"
            >
              <Text className="text-sm font-medium text-amber-950">
                Dismiss
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInAppBanner(null)}
              accessibilityRole="button"
              accessibilityLabel="OK, keep reminders on"
              className="rounded-lg bg-amber-200 px-3 py-1.5 active:bg-amber-300"
            >
              <Text className="text-sm font-medium text-amber-950">OK</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {listScope !== "all" ? (
        <FlatList
          data={displayedTasks}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={listBusy}
              onRefresh={() => void onRefresh()}
            />
          }
          contentContainerClassName="px-4 py-4"
          ListEmptyComponent={
            <Text className="mt-8 text-center text-slate-500">
              {listScope === "inZone"
                ? scopeLoading
                  ? "…"
                  : "No pin zones include your current location. Try “Near me” or move closer to a saved place."
                : scopeLoading
                  ? "…"
                  : "No pin centers within ~200 m. Try “Cover me” if you’re inside a zone."}
            </Text>
          }
          renderItem={({ item }) => (
            <TaskCard
              item={item}
              userLatLon={loc}
              reminderMutedTaskIds={reminderMutedTaskIds}
              onResumeReminders={resumeRemindersForTask}
              onRemove={removeTask}
            />
          )}
        />
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={listBusy}
              onRefresh={() => void onRefresh()}
            />
          }
          contentContainerClassName="px-4 pb-28 pt-4"
        >
          <Text className="text-xs font-medium uppercase text-slate-500">
            Saved places
          </Text>
          <Text className="mt-1 text-sm text-slate-600">
            Tap a place to see reminders, or add tasks there.
          </Text>
          {locations.length === 0 ? (
            <Text className="mt-3 text-sm text-slate-500">
              No places yet. Use + to save a map zone, then add reminders for it.
            </Text>
          ) : (
            locations.map((place) => (
              <Pressable
                key={place.id}
                onPress={() =>
                  navigation.navigate("LocationDetail", {
                    locationId: place.id,
                    name: place.name,
                  })
                }
                className="mb-3 mt-3 rounded-2xl border border-slate-200 bg-white p-4 active:bg-slate-50"
              >
                <View className="flex-row items-center gap-2.5">
                  <View className="rounded-xl bg-pin-50 p-2">
                    <PlaceMarkerIcon size={22} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-base font-semibold text-slate-900">
                      {place.name}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">
                  Radius {place.radiusMeters} m ·{" "}
                  {taskCountForLocation(place.id)} reminder
                  {taskCountForLocation(place.id) === 1 ? "" : "s"}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}

          <Text className="mt-4 text-xs font-medium uppercase text-slate-500">
            Time reminders
          </Text>
          <Text className="mt-1 text-sm text-slate-600">
            No map — scheduled nudges only.
          </Text>
          {timeOnlyTasks.length === 0 ? (
            <Text className="mt-2 text-sm text-slate-500">None yet.</Text>
          ) : (
            timeOnlyTasks.map((item) => (
              <View key={item.id} className="mt-2">
                <TaskCard
                  item={item}
                  userLatLon={loc}
                  reminderMutedTaskIds={reminderMutedTaskIds}
                  onResumeReminders={resumeRemindersForTask}
                  onRemove={removeTask}
                />
              </View>
            ))
          )}

          {legacyPinTasks.length > 0 ? (
            <>
              <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
                Map pins (before places)
              </Text>
              <Text className="mt-1 text-sm text-slate-600">
                Older reminders saved without a named place.
              </Text>
              {legacyPinTasks.map((item) => (
                <View key={item.id} className="mt-2">
                  <TaskCard
                    item={item}
                    userLatLon={loc}
                    reminderMutedTaskIds={reminderMutedTaskIds}
                    onResumeReminders={resumeRemindersForTask}
                    onRemove={removeTask}
                  />
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      <View
        className="absolute bottom-8 right-6 z-[100] h-14 w-14"
        style={{ elevation: 12 }}
      >
        <Pressable
          onPress={() => setAddMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add place or time reminder"
          className="h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg active:bg-red-700"
        >
          <Text className="text-2xl font-light text-white">+</Text>
        </Pressable>
      </View>

      <Modal
        visible={addMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAddMenuOpen(false)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            accessibilityLabel="Close"
            onPress={() => setAddMenuOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <View className="relative z-10 rounded-t-2xl border-t border-slate-200 bg-white px-4 pb-8 pt-4">
            <Text className="text-center text-base font-semibold text-slate-900">
              Add
            </Text>
            <Text className="mt-1 text-center text-sm text-slate-500">
              Choose what to create
            </Text>
            <Pressable
              onPress={() => {
                setAddMenuOpen(false);
                navigation.navigate("AddLocation");
              }}
              className="mt-4 items-center rounded-xl bg-red-600 py-4 active:bg-red-700"
            >
              <Text className="text-base font-semibold text-white">New place</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setAddMenuOpen(false);
                navigation.navigate("AddTimeReminder");
              }}
              className="mt-3 items-center rounded-xl border border-slate-200 bg-white py-4 active:bg-slate-50"
            >
              <Text className="text-base font-semibold text-slate-800">
                Time reminder
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddMenuOpen(false)}
              className="mt-3 items-center py-3"
            >
              <Text className="text-base font-medium text-slate-600">Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

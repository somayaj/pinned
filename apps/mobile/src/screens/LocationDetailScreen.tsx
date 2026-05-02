import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlaceMarkerIcon } from "../components/PlaceMarkerIcon";
import { TaskCard } from "../components/TaskCard";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { fetchTasks } from "../lib/api";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";
import type { Task } from "../types/task";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "LocationDetail">;
  route: RouteProp<RootStackParamList, "LocationDetail">;
};

export function LocationDetailScreen({ navigation, route }: Props) {
  const { locationId, name } = route.params;
  const { apiBase, removeTask, removeLocation, resumeRemindersForTask, reminderMutedTaskIds, refresh } =
    useTasks();
  const { accessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const list = await fetchTasks(apiBase, accessToken, { locationId });
      setTasks(list);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, apiBase, locationId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: name,
      headerRight: () => (
        <Pressable
          onPress={() =>
            navigation.navigate("AddTask", { locationId, locationName: name })
          }
          className="mr-2 rounded-lg bg-pin-600 px-3 py-2 active:bg-pin-700"
        >
          <Text className="text-sm font-semibold text-white">Add task</Text>
        </Pressable>
      ),
    });
  }, [navigation, locationId, name]);

  const confirmDeletePlace = () => {
    Alert.alert(
      "Delete place",
      `Delete “${name}” and all reminders tied to it?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeLocation(locationId);
                navigation.navigate("Home");
              } catch (e) {
                Alert.alert("Error", e instanceof Error ? e.message : "Failed");
              }
            })();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-red-50" edges={["bottom"]}>
      <View className="border-b border-red-100 bg-red-50 px-4 py-3">
        <Text className="text-xs font-medium uppercase text-slate-500">
          Place
        </Text>
        <View className="mt-1 flex-row items-center gap-2.5">
          <View className="rounded-xl bg-pin-50 p-2">
            <PlaceMarkerIcon size={24} />
          </View>
          <Text className="flex-1 text-lg font-semibold text-slate-900">
            {name}
          </Text>
        </View>
        <Text className="mt-1 text-xs text-slate-500">
          Reminders below fire when you enter this zone (and match any time
          window you set).
        </Text>
        <Pressable
          onPress={confirmDeletePlace}
          className="mt-3 self-start rounded-lg border border-red-200 bg-red-50 px-3 py-2"
        >
          <Text className="text-sm font-medium text-red-700">Delete place</Text>
        </Pressable>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 py-4 grow"
        refreshing={loading}
        onRefresh={() => {
          void load();
          void refresh();
        }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator className="mt-8" />
          ) : (
            <Text className="mt-8 text-center text-slate-500">
              No reminders yet. Tap “Add task” to create one for this place.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <TaskCard
            item={item}
            reminderMutedTaskIds={reminderMutedTaskIds}
            onResumeReminders={resumeRemindersForTask}
            onRemove={removeTask}
          />
        )}
      />
    </SafeAreaView>
  );
}

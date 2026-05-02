import React, { useLayoutEffect, useState } from "react";
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
import { ReminderTimeField } from "../components/ReminderTimeField";
import { useTasks } from "../context/TasksContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddTask">;
  route: RouteProp<RootStackParamList, "AddTask">;
};

/** Reminder attached to a saved place. */
export function AddTaskScreen({ navigation, route }: Props) {
  const { locationId, locationName } = route.params;
  const { addTask } = useTasks();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [remindAt, setRemindAt] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: `Task · ${locationName}` });
  }, [navigation, locationName]);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert("Reminder", "Add what you want to be reminded about.");
      return;
    }
    setBusy(true);
    try {
      await addTask({
        title: title.trim(),
        description: description.trim() || null,
        locationId,
        latitude: null,
        longitude: null,
        radiusMeters: null,
        remindAt: remindAt ? remindAt.toISOString() : null,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-8"
      >
        <Text className="mt-2 text-sm text-slate-500">
          At <Text className="font-semibold text-slate-800">{locationName}</Text>
        </Text>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Reminder
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Pick up keys"
          placeholderTextColor="#94a3b8"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Notes
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Optional details"
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="mt-2 min-h-[100px] rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Remind after (optional)
        </Text>
        <ReminderTimeField value={remindAt} onChange={setRemindAt} />

        <Pressable
          onPress={() => void save()}
          disabled={busy}
          className="mt-8 items-center rounded-xl bg-sky-600 py-4 active:bg-sky-700 disabled:opacity-60"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Save task</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

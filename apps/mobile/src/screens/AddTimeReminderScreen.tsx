import React, { useState } from "react";
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
import type { RootStackParamList } from "../navigation/types";

function defaultRemindTime(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddTimeReminder">;
};

/** Time-only reminder (no map). */
export function AddTimeReminderScreen({ navigation }: Props) {
  const { addTask } = useTasks();
  const [title, setTitle] = useState("");
  const [remindAt, setRemindAt] = useState<Date | null>(defaultRemindTime());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert("Reminder", "Add a short title.");
      return;
    }
    if (!remindAt) {
      Alert.alert("Time", "Choose when to be reminded.");
      return;
    }
    setBusy(true);
    try {
      await addTask({
        title: title.trim(),
        description: null,
        latitude: null,
        longitude: null,
        radiusMeters: null,
        remindAt: remindAt.toISOString(),
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
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <Text className="mt-2 text-sm text-slate-500">
          No map — we’ll nudge on a schedule while reminders are on.
        </Text>
        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Reminder
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Call dentist"
          placeholderTextColor="#94a3b8"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />
        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Remind at
        </Text>
        <ReminderTimeField value={remindAt} onChange={setRemindAt} />
        <Pressable
          onPress={() => void save()}
          disabled={busy}
          className="mt-8 items-center rounded-xl bg-pin-600 py-4 active:bg-pin-700 disabled:opacity-60"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Save</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

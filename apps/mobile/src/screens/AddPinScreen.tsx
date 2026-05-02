import * as Location from "expo-location";
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
import { useTasks } from "../context/TasksContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddPin">;
};

export function AddPinScreen({ navigation }: Props) {
  const { addTask } = useTasks();
  const [title, setTitle] = useState("");
  const [radius, setRadius] = useState("200");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);

  const useHere = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location", "Permission is required to drop a pin.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setLat(String(pos.coords.latitude));
    setLon(String(pos.coords.longitude));
  };

  const save = async () => {
    const r = Number(radius);
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!title.trim()) {
      Alert.alert("Title", "Add a short reminder title.");
      return;
    }
    if (!Number.isFinite(r) || r < 10) {
      Alert.alert("Radius", "Radius must be at least 10 meters.");
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert("Location", "Set latitude and longitude or use current location.");
      return;
    }
    setBusy(true);
    try {
      await addTask({
        title: title.trim(),
        latitude,
        longitude,
        radiusMeters: r,
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
        <Text className="mt-2 text-xl font-semibold text-slate-900">
          New pin
        </Text>
        <Text className="mt-1 text-sm text-slate-500">
          We’ll nudge you when you enter the radius around this point.
        </Text>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Reminder
        </Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Pick up dry cleaning"
          placeholderTextColor="#94a3b8"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-4 text-xs font-medium uppercase text-slate-500">
          Radius (meters)
        </Text>
        <TextInput
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />

        <Pressable
          onPress={() => void useHere()}
          className="mt-4 self-start rounded-xl bg-sky-100 px-4 py-3 active:bg-sky-200"
        >
          <Text className="font-semibold text-sky-800">Use current location</Text>
        </Pressable>

        <Text className="mt-4 text-xs font-medium uppercase text-slate-500">
          Latitude
        </Text>
        <TextInput
          value={lat}
          onChangeText={setLat}
          keyboardType="decimal-pad"
          placeholder="37.77"
          placeholderTextColor="#94a3b8"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />
        <Text className="mt-4 text-xs font-medium uppercase text-slate-500">
          Longitude
        </Text>
        <TextInput
          value={lon}
          onChangeText={setLon}
          keyboardType="decimal-pad"
          placeholder="-122.42"
          placeholderTextColor="#94a3b8"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />

        <Pressable
          onPress={() => void save()}
          disabled={busy}
          className="mt-8 items-center rounded-xl bg-sky-600 py-4 active:bg-sky-700 disabled:opacity-60"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">Save pin</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

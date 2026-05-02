import * as Location from "expo-location";
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
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
import AddPinMap from "../components/AddPinMap";
import { geocodeSearch } from "../lib/geocode";
import { useTasks } from "../context/TasksContext";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

/** Default map center (San Francisco) before search or GPS. */
const DEFAULT_LAT = 37.7749;
const DEFAULT_LON = -122.4194;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddPin">;
};

export function AddPinScreen({ navigation }: Props) {
  const { addTask } = useTasks();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.replace("Home")}
          className="mr-2 rounded-lg bg-slate-100 px-3 py-2 active:bg-slate-200"
        >
          <Text className="text-sm font-medium text-sky-700">My pins</Text>
        </Pressable>
      ),
    });
  }, [navigation]);
  const [title, setTitle] = useState("");
  const [radius, setRadius] = useState("200");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [recenterKey, setRecenterKey] = useState(0);

  const [lat, setLat] = useState(String(DEFAULT_LAT));
  const [lon, setLon] = useState(String(DEFAULT_LON));
  const [busy, setBusy] = useState(false);

  const syncFieldsFromPin = useCallback((la: number, lo: number) => {
    setLat(la.toFixed(6));
    setLon(lo.toFixed(6));
  }, []);

  const onMapCoordinateChange = useCallback(
    (la: number, lo: number) => {
      syncFieldsFromPin(la, lo);
    },
    [syncFieldsFromPin],
  );

  const parsedLatLon = useMemo(() => {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { latitude: DEFAULT_LAT, longitude: DEFAULT_LON };
    }
    return { latitude, longitude };
  }, [lat, lon]);

  const useHere = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Location", "Permission is required to drop a pin.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    syncFieldsFromPin(pos.coords.latitude, pos.coords.longitude);
    setRecenterKey((k) => k + 1);
  };

  const runSearch = async () => {
    const q = searchQuery.trim();
    if (!q) {
      Alert.alert("Search", "Enter an address, city, or ZIP code.");
      return;
    }
    setSearchBusy(true);
    try {
      const result = await geocodeSearch(q);
      if (!result) {
        Alert.alert(
          "Not found",
          "Try a full street address, city and state, or ZIP code.",
        );
        return;
      }
      syncFieldsFromPin(result.latitude, result.longitude);
      setRecenterKey((k) => k + 1);
    } finally {
      setSearchBusy(false);
    }
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
      Alert.alert("Location", "Set a location on the map or use search / GPS.");
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
      navigation.replace("Home");
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
          Search by address or ZIP, drag the pin, or tap the map. We’ll nudge you
          when you enter the radius.
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

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Address or ZIP
        </Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="e.g. 94102 or 1600 Amphitheatre Pkwy, Mountain View"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900"
        />
        <View className="mt-3 flex-row gap-2">
          <Pressable
            onPress={() => void runSearch()}
            disabled={searchBusy}
            className="flex-1 items-center rounded-xl bg-sky-600 py-3 active:bg-sky-700 disabled:opacity-60"
          >
            {searchBusy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Search on map</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => void useHere()}
            className="flex-1 items-center rounded-xl bg-sky-100 py-3 active:bg-sky-200"
          >
            <Text className="font-semibold text-sky-800">Use my location</Text>
          </Pressable>
        </View>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Map
        </Text>
        <View className="mt-2 overflow-hidden rounded-xl">
          <AddPinMap
            latitude={parsedLatLon.latitude}
            longitude={parsedLatLon.longitude}
            onCoordinateChange={onMapCoordinateChange}
            recenterKey={recenterKey}
          />
        </View>

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

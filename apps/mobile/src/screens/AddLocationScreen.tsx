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
import { useTasks } from "../context/TasksContext";
import { geocodeSearch } from "../lib/geocode";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

const DEFAULT_LAT = 37.7749;
const DEFAULT_LON = -122.4194;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "AddLocation">;
};

/** Step 1 of the flow: define a **place** (map zone + name). Tasks are added from the place screen. */
export function AddLocationScreen({ navigation }: Props) {
  const { addLocation } = useTasks();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate("Home")}
          className="mr-2 rounded-lg border border-red-100 bg-white/90 px-3 py-2 active:bg-red-50"
        >
          <Text className="text-sm font-medium text-sky-700">Home</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
      Alert.alert("Location", "Permission is required to place the zone.");
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
    if (!name.trim()) {
      Alert.alert("Name", "Give this place a name (e.g. Home, Office).");
      return;
    }
    const r = Number(radius);
    const latitude = Number(lat);
    const longitude = Number(lon);
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
      const loc = await addLocation({
        name: name.trim(),
        description: description.trim() || null,
        latitude,
        longitude,
        radiusMeters: r,
      });
      navigation.replace("LocationDetail", {
        locationId: loc.id,
        name: loc.name,
      });
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-red-50" edges={["bottom"]}>
      <ScrollView
        className="flex-1 px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-8"
      >
        <Text className="mt-2 text-xl font-semibold text-slate-900">
          New place
        </Text>
        <Text className="mt-1 text-sm text-slate-500">
          Set where it is on the map, then add reminders for this place from the
          next screen.
        </Text>

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Place name
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Home, Gym"
          placeholderTextColor="#94a3b8"
          className="mt-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Place notes
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Optional — parking, entrance, etc."
          placeholderTextColor="#94a3b8"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          className="mt-2 min-h-[80px] rounded-xl border border-red-100 bg-white px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Radius (meters)
        </Text>
        <TextInput
          value={radius}
          onChangeText={setRadius}
          keyboardType="number-pad"
          className="mt-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-base text-slate-900"
        />

        <Text className="mt-6 text-xs font-medium uppercase text-slate-500">
          Address or ZIP
        </Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="e.g. 94102 or 1 Apple Park Way"
          placeholderTextColor="#94a3b8"
          autoCapitalize="words"
          className="mt-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-base text-slate-900"
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

        <Pressable
          onPress={() => void save()}
          disabled={busy}
          className="mt-8 items-center rounded-xl bg-sky-600 py-4 active:bg-sky-700 disabled:opacity-60"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-base font-semibold text-white">
              Save place
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

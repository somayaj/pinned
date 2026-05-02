import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTasks } from "../context/TasksContext";
import { DEFAULT_API_BASE, getApiBaseUrl } from "../lib/config";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Settings">;
};

export function SettingsScreen({ navigation }: Props) {
  const { setApiBase } = useTasks();
  const [url, setUrl] = useState("");

  useEffect(() => {
    void (async () => {
      const u = await getApiBaseUrl();
      setUrl(u);
    })();
  }, []);

  const save = async () => {
    await setApiBase(url.trim() || DEFAULT_API_BASE);
    navigation.goBack();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center border-b border-slate-200 px-2 py-2">
        <Pressable onPress={() => navigation.goBack()} className="px-2 py-2">
          <Text className="text-sky-600">Back</Text>
        </Pressable>
        <Text className="flex-1 text-center text-lg font-semibold text-slate-900">
          Settings
        </Text>
        <View className="w-12" />
      </View>
      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-xs font-medium uppercase text-slate-500">
          API base URL
        </Text>
        <Text className="mt-1 text-sm text-slate-500">
          Your Railway pinned-api URL (https, no trailing slash).
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
        />
        <Pressable
          onPress={() => void save()}
          className="mt-6 items-center rounded-xl bg-sky-600 py-4 active:bg-sky-700"
        >
          <Text className="font-semibold text-white">Save</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

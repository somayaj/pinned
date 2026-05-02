import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useTasks } from "../context/TasksContext";
import { fetchUserProfile, patchUserProfile } from "../lib/api";
import { DEFAULT_API_BASE, getApiBaseUrl } from "../lib/config";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Settings">;
};

export function SettingsScreen({ navigation }: Props) {
  const { accessToken } = useAuth();
  const { setApiBase } = useTasks();
  const [url, setUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const u = await getApiBaseUrl();
      setUrl(u);
      if (!accessToken) {
        setProfileLoading(false);
        return;
      }
      try {
        const p = await fetchUserProfile(u, accessToken);
        setPhone(p.phoneE164 ?? "");
        setSmsAlerts(p.smsAlerts);
      } catch {
        /* Older API without /auth/profile — leave fields empty */
      } finally {
        setProfileLoading(false);
      }
    })();
  }, [accessToken]);

  const save = async () => {
    try {
      await setApiBase(url.trim() || DEFAULT_API_BASE);
      const base = await getApiBaseUrl();
      if (accessToken) {
        await patchUserProfile(base, accessToken, {
          phoneE164: phone.trim() || null,
          smsAlerts,
        });
      }
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save";
      if (/invalid_phone|400/.test(msg)) {
        Alert.alert(
          "Phone number",
          "Use international format with country code, e.g. +14155552671"
        );
        return;
      }
      Alert.alert("Settings", msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center border-b border-slate-200 px-2 py-2">
        <Pressable onPress={() => navigation.goBack()} className="px-2 py-2">
          <Text className="text-pin-600">Back</Text>
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

        <Text className="mt-8 text-xs font-medium uppercase text-slate-500">
          SMS alerts
        </Text>
        <Text className="mt-1 text-sm text-slate-500">
          Get a text when you get the same PIN it reminders (new task, zone
          entry, scheduled nudge). Requires Twilio on the server and your number
          in E.164 format.
        </Text>
        {profileLoading ? (
          <ActivityIndicator className="mt-4" />
        ) : (
          <>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+14155552671"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="phone-pad"
              className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
            />
            <View className="mt-4 flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Text className="flex-1 text-sm text-slate-800">
                Send SMS for alerts
              </Text>
              <Switch
                value={smsAlerts}
                onValueChange={setSmsAlerts}
                trackColor={{ false: "#cbd5e1", true: "#fecaca" }}
                thumbColor={smsAlerts ? "#dc2626" : "#f4f4f5"}
              />
            </View>
          </>
        )}

        <Pressable
          onPress={() => void save()}
          className="mt-6 items-center rounded-xl bg-pin-600 py-4 active:bg-pin-700"
        >
          <Text className="font-semibold text-white">Save</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

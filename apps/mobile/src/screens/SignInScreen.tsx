import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import {
  DEFAULT_API_BASE,
  getApiBaseUrl,
  setApiBaseUrl,
} from "../lib/config";

export function SignInScreen() {
  const { promptGoogleSignIn, signingIn, signInError } = useAuth();
  const [apiUrl, setApiUrl] = useState("");
  const [apiSaved, setApiSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const u = await getApiBaseUrl();
      setApiUrl(u);
    })();
  }, []);

  const saveApiUrl = async () => {
    await setApiBaseUrl(apiUrl.trim() || DEFAULT_API_BASE);
    const next = await getApiBaseUrl();
    setApiUrl(next);
    setApiSaved(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1 px-6"
        contentContainerClassName="flex-grow justify-center py-12"
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-center text-3xl font-semibold text-slate-900">
          Pinned
        </Text>
        <Text className="mt-2 text-center text-base leading-6 text-slate-600">
          Dropping a pin sets a reminder at a location.
        </Text>

        <View className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <Text className="text-xs font-medium uppercase text-slate-500">
            API base URL
          </Text>
          <Text className="mt-1 text-xs leading-5 text-slate-500">
            Your pinned-api host (https, no trailing slash). On web, do not use the
            Expo port — use your Railway URL or local API port.
          </Text>
          <TextInput
            value={apiUrl}
            onChangeText={(t) => {
              setApiUrl(t);
              setApiSaved(false);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
          />
          <Pressable
            onPress={() => void saveApiUrl()}
            className="mt-3 items-center rounded-lg bg-slate-200 py-2.5 active:bg-slate-300"
          >
            <Text className="text-sm font-medium text-slate-800">Save API URL</Text>
          </Pressable>
          {apiSaved ? (
            <Text className="mt-2 text-center text-xs text-emerald-600">
              Saved — you can sign in below.
            </Text>
          ) : null}
        </View>

        <View className="mt-10">
          <Pressable
            onPress={() => void promptGoogleSignIn()}
            disabled={signingIn}
            className="flex-row items-center justify-center rounded-xl bg-sky-600 px-5 py-4 active:bg-sky-700 disabled:opacity-60"
          >
            {signingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-center text-base font-semibold text-white">
                Continue with Google
              </Text>
            )}
          </Pressable>
        </View>

        {signInError ? (
          <Text className="mt-4 text-center text-sm text-red-600">
            {signInError}
          </Text>
        ) : null}

        <Text className="mt-8 text-center text-xs leading-5 text-slate-400">
          Sign in to sync pins and get reminders when you arrive.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

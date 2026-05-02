import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";

export function SignInScreen() {
  const { promptGoogleSignIn, signingIn, signInError } = useAuth();

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

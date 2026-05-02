import React from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GoogleGlyphIcon } from "../components/GoogleGlyphIcon";
import { PinItLogoIcon } from "../components/PinItLogoIcon";
import { useAuth } from "../context/AuthContext";

/** US map with push pins — bundled. Source: Daniel Tasci on Unsplash (Unsplash License). https://unsplash.com/photos/map-of-the-united-states-with-pins-o2DAV3_w0Vo */
const landingHero = require("../../assets/landing-hero.jpg");

function PinItLogoMark() {
  return (
    <View
      className="h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm shadow-pin-200/40"
      accessibilityLabel="Pin it — map, pin, and tasks"
      accessibilityRole="image"
    >
      <PinItLogoIcon size={44} />
    </View>
  );
}

const WIDE_BREAKPOINT = 768;

export function SignInScreen() {
  const { promptGoogleSignIn, signingIn, signInError } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  return (
    <ImageBackground
      source={landingHero}
      className="flex-1"
      resizeMode="cover"
      accessibilityIgnoresInvertColors
    >
      <View
        className="flex-1"
        style={{ flexDirection: isWide ? "row" : "column" }}
      >
        {isWide ? <View className="min-w-0 flex-1 bg-slate-900/15" /> : null}

        <View
          className={`bg-white shadow-lg ${isWide ? "border-l border-slate-200" : "mx-4 my-5 flex-1 rounded-3xl border border-slate-200"}`}
          style={
            isWide
              ? {
                  width: Math.min(448, width * 0.44),
                  maxWidth: 480,
                  alignSelf: "stretch",
                }
              : undefined
          }
        >
          <SafeAreaView className="flex-1" edges={["top", "bottom"]}>
            <ScrollView
              className="flex-1"
              contentContainerClassName="grow px-7 pb-10 pt-8"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="mx-auto w-full max-w-md self-center">
                <View className="items-center px-1">
                  <PinItLogoMark />
                  <Text
                    className="mt-4 text-2xl font-bold tracking-tight"
                    accessibilityRole="header"
                  >
                    <Text className="text-red-600">Pin</Text>
                    <Text className="text-slate-900"> it</Text>
                  </Text>
                  <View className="mt-2 h-1 w-9 rounded-full bg-red-500" />
                  <Text className="mt-4 text-center text-[15px] leading-6 text-slate-600">
                    Reminders tied to real places — and a few extras when you need them.
                  </Text>
                </View>

                <Text className="mt-10 text-center text-[15px] leading-7 text-slate-700">
                  Save locations on the map, add tasks under each place, and get
                  reminded when you enter that area. Set time-only reminders when a pin
                  is not the right fit. Mute a noisy reminder without losing the pin;
                  turn on SMS in Settings if you want texts too.
                </Text>

                <Text className="mt-5 text-center text-[15px] leading-7 text-slate-700">
                  Optional headline and watchlist cards can sit quietly in the corner
                  while you use the app. Everything syncs between web and phone with the
                  same account.
                </Text>

                <Text className="mt-8 text-center text-sm leading-6 text-slate-600">
                  Sign in with Google so we know who you are and can sync your data. We
                  never see your Google password.
                </Text>

                <Pressable
                  onPress={() => void promptGoogleSignIn()}
                  disabled={signingIn}
                  accessibilityRole="button"
                  accessibilityLabel="Sign in with Google"
                  className="mt-6 min-h-[52px] flex-row items-center justify-center gap-3 rounded-full border border-slate-800 bg-white px-5 py-3.5 active:bg-slate-100 disabled:opacity-55"
                >
                  {signingIn ? (
                    <ActivityIndicator color="#0a0a0a" />
                  ) : (
                    <>
                      <GoogleGlyphIcon size={22} />
                      <Text className="text-[17px] font-semibold text-[#3c4043]">
                        Sign in with Google
                      </Text>
                    </>
                  )}
                </Pressable>

                {signInError ? (
                  <Text className="mt-5 text-center text-sm leading-5 text-red-600">
                    {signInError}
                  </Text>
                ) : null}

                <Text className="mt-10 text-center text-[10px] text-slate-400">
                  Background: Daniel Tasci / Unsplash
                </Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </View>
    </ImageBackground>
  );
}

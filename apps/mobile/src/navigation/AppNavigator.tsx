import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useAuth } from "../context/AuthContext";
import { AddPinScreen } from "../screens/AddPinScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Only mounts when the user has a session. First screen is Add pin (map) so
 * post–sign-in flow goes: Sign in → map → optional “My pins” to the list.
 */
export function AppNavigator() {
  const { accessToken } = useAuth();

  return (
    <NavigationContainer key={accessToken ?? "nav"}>
      <Stack.Navigator initialRouteName="AddPin">
        <Stack.Screen
          name="AddPin"
          component={AddPinScreen}
          options={{ title: "Add pin", headerShown: true }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

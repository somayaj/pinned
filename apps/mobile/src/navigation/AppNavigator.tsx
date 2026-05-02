import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { useAuth } from "../context/AuthContext";
import { AddLocationScreen } from "../screens/AddLocationScreen";
import { AddTaskScreen } from "../screens/AddTaskScreen";
import { AddTimeReminderScreen } from "../screens/AddTimeReminderScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LocationDetailScreen } from "../screens/LocationDetailScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { StocksScreen } from "../screens/StocksScreen";
import { NewsScreen } from "../screens/NewsScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Signed-in stack: home lists places and time reminders; add place → tasks per place. */
export function AppNavigator() {
  const { accessToken } = useAuth();

  return (
    <NavigationContainer
      key={accessToken ?? "nav"}
      documentTitle={{
        formatter: (options) =>
          options?.title ? `${options.title} · PinIt` : "PinIt",
      }}
    >
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          contentStyle: { backgroundColor: "#fef2f2" },
          headerStyle: { backgroundColor: "#fef2f2" },
          headerShadowVisible: false,
          headerTintColor: "#0f172a",
          headerTitleStyle: { color: "#0f172a", fontWeight: "600" },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddLocation"
          component={AddLocationScreen}
          options={{ title: "New place", headerShown: true }}
        />
        <Stack.Screen
          name="LocationDetail"
          component={LocationDetailScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="AddTask"
          component={AddTaskScreen}
          options={{ headerShown: true }}
        />
        <Stack.Screen
          name="AddTimeReminder"
          component={AddTimeReminderScreen}
          options={{ title: "Time reminder", headerShown: true }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Stocks"
          component={StocksScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="News"
          component={NewsScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

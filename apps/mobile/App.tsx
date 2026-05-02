import "./global.css";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { TasksProvider } from "./src/context/TasksContext";
import { TaskAlertOverlay } from "./src/components/TaskAlertOverlay";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { SignInScreen } from "./src/screens/SignInScreen";
import { SafeAreaProvider } from "react-native-safe-area-context";

function AuthenticatedApp() {
  const { accessToken } = useAuth();
  if (!accessToken) {
    return <SignInScreen />;
  }
  return (
    <TasksProvider>
      <AppNavigator />
      <TaskAlertOverlay />
    </TasksProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthenticatedApp />
        <StatusBar style="auto" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

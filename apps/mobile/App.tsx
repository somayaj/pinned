import "./global.css";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { TasksProvider } from "./src/context/TasksContext";
import { StocksProvider } from "./src/context/StocksContext";
import { NewsProvider } from "./src/context/NewsContext";
import { BuiltinJobsProvider } from "./src/context/BuiltinJobsContext";
import { TaskAlertOverlay } from "./src/components/TaskAlertOverlay";
import { BottomToastStack } from "./src/components/BottomToastStack";
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
      <StocksProvider>
        <NewsProvider>
          <BuiltinJobsProvider>
            <AppNavigator />
            <TaskAlertOverlay />
            <BottomToastStack />
          </BuiltinJobsProvider>
        </NewsProvider>
      </StocksProvider>
    </TasksProvider>
  );
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.title = "Pin it";
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthenticatedApp />
          <StatusBar style="auto" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import "./global.css";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { TasksProvider } from "./src/context/TasksContext";
import { StocksProvider } from "./src/context/StocksContext";
import { NewsProvider } from "./src/context/NewsContext";
import { TaskAlertOverlay } from "./src/components/TaskAlertOverlay";
import { StockQuoteAlert } from "./src/components/StockQuoteAlert";
import { NewsToast } from "./src/components/NewsToast";
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
          <AppNavigator />
          <TaskAlertOverlay />
          <StockQuoteAlert />
          <NewsToast />
        </NewsProvider>
      </StocksProvider>
    </TasksProvider>
  );
}

export default function App() {
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

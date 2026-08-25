import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { AuthProvider } from "./src/context/AuthContext";
import { LayoutModeProvider } from "./src/context/LayoutModeContext";
import { ThemeProvider, useThemeColors, useTheme } from "./src/context/ThemeContext";
import { TravelProvider, useTravel } from "./src/context/TravelContext";
import RootNavigator from "./src/navigation/RootNavigator";

// Hold the native splash until saved data has loaded, so the app never flashes an
// empty map before AsyncStorage comes back. Both calls are best-effort: a rejection
// here must not be the thing that stops the app starting.
SplashScreen.preventAutoHideAsync().catch(() => {});

function Ready({ children }: { children: React.ReactNode }) {
  const { loaded } = useTravel();

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  return <>{children}</>;
}

function Root() {
  const colors = useThemeColors();
  const { scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <TravelProvider>
            <Ready>
            <RootNavigator />
            <StatusBar style={scheme === "light" ? "dark" : "light"} />
            </Ready>
          </TravelProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LayoutModeProvider>
          <Root />
        </LayoutModeProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

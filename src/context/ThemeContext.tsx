import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { ColorPalette, darkColors, lightColors } from "../theme/colors";

const STORAGE_KEY_THEME = "vamos:theme:v1";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedScheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  scheme: ResolvedScheme;
  colors: ColorPalette;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_THEME).then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    AsyncStorage.setItem(STORAGE_KEY_THEME, pref).catch(() => {});
  };

  const scheme: ResolvedScheme = preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference;
  const colors = scheme === "light" ? lightColors : darkColors;

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, scheme, colors, setPreference }),
    [preference, scheme, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

export function useThemeColors(): ColorPalette {
  return useTheme().colors;
}

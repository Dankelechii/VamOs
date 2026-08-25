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
  // "system" was dropped as a user-facing choice (no button for it anymore — light
  // and dark are the whole set), so the default landing spot is the brand-forward
  // light theme rather than something that follows the OS.
  const [preference, setPreferenceState] = useState<ThemePreference>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_THEME).then((stored) => {
      if (stored === "light" || stored === "dark") {
        setPreferenceState(stored);
      } else if (stored === "system") {
        // Migrate anyone who had the now-removed option selected onto whichever
        // theme it was actually resolving to, so nothing changes for them visually
        // and a button is correctly highlighted next time they open this screen.
        const resolved: ThemePreference = systemScheme === "dark" ? "dark" : "light";
        setPreferenceState(resolved);
        AsyncStorage.setItem(STORAGE_KEY_THEME, resolved).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

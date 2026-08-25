import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useWindowDimensions } from "react-native";

const STORAGE_KEY = "vamos:layoutMode:v1";
// Below this, "website mode" (a top nav bar, multi-column screens) has no room to
// actually pay for itself — the phone-shaped layout stays the better use of the
// space even in a browser tab.
const DESKTOP_BREAKPOINT = 860;

export type LayoutMode = "mobile" | "website";

interface LayoutModeContextValue {
  /** Always "mobile" on native — there's no browser chrome to react to there. */
  mode: LayoutMode;
  isWeb: boolean;
  setMode: (mode: LayoutMode) => void;
}

const LayoutModeContext = createContext<LayoutModeContextValue | undefined>(undefined);

export function LayoutModeProvider({ children }: { children: React.ReactNode }) {
  const isWeb = Platform.OS === "web";
  const { width } = useWindowDimensions();
  const [mode, setModeState] = useState<LayoutMode>(
    isWeb && width >= DESKTOP_BREAKPOINT ? "website" : "mobile"
  );
  // Once the user has explicitly picked a mode, resizing the window stops silently
  // overriding it — same idea as the theme picker not fighting a browser's own dark
  // mode setting once you've told it "light" or "dark" specifically.
  const [hasExplicitPref, setHasExplicitPref] = useState(false);

  useEffect(() => {
    if (!isWeb) return;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "mobile" || stored === "website") {
        setModeState(stored);
        setHasExplicitPref(true);
      }
    });
  }, [isWeb]);

  useEffect(() => {
    if (!isWeb || hasExplicitPref) return;
    setModeState(width >= DESKTOP_BREAKPOINT ? "website" : "mobile");
  }, [width, isWeb, hasExplicitPref]);

  const setMode = (next: LayoutMode) => {
    setModeState(next);
    setHasExplicitPref(true);
    if (isWeb) AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const value = useMemo<LayoutModeContextValue>(
    () => ({ mode: isWeb ? mode : "mobile", isWeb, setMode }),
    [mode, isWeb]
  );

  return <LayoutModeContext.Provider value={value}>{children}</LayoutModeContext.Provider>;
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error("useLayoutMode must be used within a LayoutModeProvider");
  return ctx;
}

// The logo's own fixed cream backdrop — used for brand moments (the landing screen)
// that should look identical regardless of the user's light/dark theme preference,
// matching the baked-in background of the logo image assets themselves.
export const BRAND_CREAM = "#FAF3E7";
export const BRAND_NAVY = "#182242";

export interface ColorPalette {
  bg: string;
  bgElevated: string;
  card: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  accent: string;
  accentSoft: string;
  accent2: string;
  accent2Soft: string;
  gold: string;

  unvisited: string;
  unvisitedStroke: string;
  visited: string;
  visitedStroke: string;
  visitedSelected: string;

  ocean: string;
  white: string;
  danger: string;

  statusBarStyle: "light" | "dark";
}

// Both palettes are pulled directly from the VamOs logo's three colors — deep navy
// wordmark, gold arrow/globe accent, cream background. Filled-in countries are the
// logo's gold too, at the user's request: the map is the app's signature screen, and
// a green fill was the one large area of colour that had nothing to do with the
// brand. Only "danger" red stays semantic, since a destructive action has to read as
// a warning rather than as brand.
//
// Because the fill is now the same family as the accent, a selected country can't be
// distinguished by a gold stroke any more — `visitedSelected` is deliberately the
// contrasting navy/cream ink instead, so selection still reads on top of a gold fill.
export const darkColors: ColorPalette = {
  bg: "#111931", // deep navy, tuned darker than the logo wordmark for a true dark ground
  bgElevated: "#1A2444",
  card: "#1A2444",
  cardBorder: "#2C3860",
  textPrimary: "#F8F2E4", // logo's cream, used as the dark-mode "ink" color
  textSecondary: "#B7C0E0",
  textMuted: "#76819F",

  accent: "#DDA83F", // logo gold
  accentSoft: "#DDA83F33",
  accent2: "#E9B84A", // filled-in country gold — brand, not a semantic success green
  accent2Soft: "#E9B84A33",
  gold: "#F0C36B", // lighter secondary gold for highlights distinct from accent

  unvisited: "#1E2846", // "blacked out" country fill
  unvisitedStroke: "#2E3A64",
  visited: "#E9B84A", // a touch brighter than the accent so fills lift off the navy ground
  visitedStroke: "#F6D488",
  visitedSelected: "#FFF6E2", // pale cream outline: the only thing that reads on gold here

  ocean: "#111931",
  white: "#FFFFFF",
  danger: "#FF5470",

  statusBarStyle: "light" as const,
};

// Built around the VamOs logo's cream (#FAF3E7 background, deep navy wordmark, gold
// arrow) rather than a naive inversion of the dark palette.
export const lightColors: ColorPalette = {
  bg: "#FAF3E7",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardBorder: "#E7DECB",
  textPrimary: "#182242", // logo navy
  textSecondary: "#5B6B8C",
  textMuted: "#8D93A8",

  accent: "#A9750F", // deepened logo gold for AA contrast on cream/white
  accentSoft: "#A9750F26",
  accent2: "#B0791A", // filled-in country gold — brand, not a semantic success green
  accent2Soft: "#B0791A26",
  gold: "#8A6417", // darker secondary gold for highlights distinct from accent

  unvisited: "#ECE3D0", // "blacked out" reads as dim/muted-cream on light
  unvisitedStroke: "#D8CBAE",
  visited: "#E0A83A", // saturated enough to hold its own against the cream ground
  visitedStroke: "#B0791A",
  visitedSelected: "#182242", // navy outline: the only thing that reads on gold here

  ocean: "#FAF3E7",
  white: "#FFFFFF",
  danger: "#D93A56",

  statusBarStyle: "dark" as const,
};

// Fixed dark-navy alias kept for any code that hasn't migrated to useThemeColors()
// yet. Prefer the hook everywhere so colors respond to the user's theme choice.
export const colors = darkColors;

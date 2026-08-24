import { Continent, WORLD_COUNTRIES } from "./worldCountries";
import { VisitedMap } from "../types";

export interface BadgeTier {
  id: string;
  name: string;
  threshold: number; // number of distinct continents required
  color: string;
}

// 7 tiers for 7 continents — collect one of each continent to reach Platinum.
export const BADGE_TIERS: BadgeTier[] = [
  { id: "yellow", name: "Yellow", threshold: 1, color: "#F2CB4E" },
  { id: "green", name: "Green", threshold: 2, color: "#3DDC97" },
  { id: "bronze", name: "Bronze", threshold: 3, color: "#C97F4A" },
  { id: "silver", name: "Silver", threshold: 4, color: "#B9C2CC" },
  { id: "gold", name: "Gold", threshold: 5, color: "#F0B23A" },
  { id: "diamond", name: "Diamond", threshold: 6, color: "#7DD3FC" },
  { id: "platinum", name: "Platinum", threshold: 7, color: "#E3E7EE" },
];

const COUNTRY_CONTINENT: Record<string, Continent> = Object.fromEntries(
  WORLD_COUNTRIES.map((c) => [c.id, c.continent])
);

export function getVisitedContinents(visited: VisitedMap): Set<Continent> {
  const set = new Set<Continent>();
  for (const countryId of Object.keys(visited)) {
    const continent = COUNTRY_CONTINENT[countryId];
    if (continent) set.add(continent);
  }
  return set;
}

/** The highest tier earned so far, or null if no continent has been visited yet. */
export function getCurrentBadge(continentCount: number): BadgeTier | null {
  let current: BadgeTier | null = null;
  for (const tier of BADGE_TIERS) {
    if (continentCount >= tier.threshold) current = tier;
  }
  return current;
}

/** The next tier still to unlock, or null if every tier (Platinum) is already earned. */
export function getNextBadge(continentCount: number): BadgeTier | null {
  return BADGE_TIERS.find((tier) => continentCount < tier.threshold) ?? null;
}

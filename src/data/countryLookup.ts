import { CountryGeo, WORLD_COUNTRIES } from "./worldCountries";

// WORLD_COUNTRIES is a 177-entry array and worldCountries.ts is auto-generated, so
// the id index lives here instead: a linear .find() per render is fine for a one-off
// lookup but not for a list that re-renders on every scroll frame (the photo wheel).
const BY_ID: Map<string, CountryGeo> = new Map(WORLD_COUNTRIES.map((c) => [c.id, c]));

export function getCountryById(id: string): CountryGeo | undefined {
  return BY_ID.get(id);
}

export type Bounds = [[number, number], [number, number]];

const FRAME_BOUNDS: Map<string, Bounds> = new Map();

/**
 * Bounds of a country's *largest single landmass*, rather than of everything it owns.
 *
 * `CountryGeo.bounds` covers every polygon, which for a country with distant
 * territories is mostly empty ocean — the United States' box runs from the Aleutians
 * to Maine, so framing to it shrinks the recognisable mainland to a few specks. This
 * picks the biggest subpath instead, so the shape reads at small sizes. Outlying
 * islands simply fall outside the viewport.
 */
export function getCountryFrameBounds(id: string): Bounds | undefined {
  const cached = FRAME_BOUNDS.get(id);
  if (cached) return cached;

  const country = BY_ID.get(id);
  if (!country) return undefined;

  let best: Bounds | null = null;
  let bestArea = -1;

  // Paths are generated as absolute "M x,y L x,y ... Z" subpaths, one per polygon.
  for (const sub of country.path.split("M").slice(1)) {
    const nums = sub.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || nums.length < 4) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]);
      const y = Number(nums[i + 1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) {
      bestArea = area;
      best = [
        [minX, minY],
        [maxX, maxY],
      ];
    }
  }

  const out = best ?? country.bounds;
  FRAME_BOUNDS.set(id, out);
  return out;
}

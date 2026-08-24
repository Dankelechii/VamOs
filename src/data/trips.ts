import { LegacyVisitedCountry, Photo, Trip, VisitedCountry, VisitedMap } from "../types";

let idCounter = 0;

/** Date.now() alone collides when two trips are created in the same millisecond. */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** ISO `YYYY-MM-01` for the month containing `date` (defaults to now). */
export function monthStamp(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function makeTrip(patch: Partial<Trip> = {}): Trip {
  return {
    id: newId("trip"),
    startDate: monthStamp(),
    photos: [],
    ...patch,
  };
}

/** Newest first, with undated trips at the top — they're the ones just added. */
export function sortTrips(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return -1;
    if (!b.startDate) return 1;
    return b.startDate.localeCompare(a.startDate);
  });
}

export function countryPhotos(record: VisitedCountry | undefined): Photo[] {
  if (!record) return [];
  return sortTrips(record.trips).flatMap((t) => t.photos);
}

export function countryPhotoCount(record: VisitedCountry | undefined): number {
  if (!record) return 0;
  return record.trips.reduce((n, t) => n + t.photos.length, 0);
}

export interface TimelineEntry {
  trip: Trip;
  countryId: string;
}

/** Every trip across every country, newest first — the Profile timeline. */
export function allTrips(visited: VisitedMap): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const record of Object.values(visited)) {
    for (const trip of record.trips) entries.push({ trip, countryId: record.countryId });
  }
  return entries.sort((a, b) => {
    const at = a.trip.startDate ?? "";
    const bt = b.trip.startDate ?? "";
    if (!at && !bt) return 0;
    if (!at) return -1;
    if (!bt) return 1;
    return bt.localeCompare(at);
  });
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Mar 2024", "Mar – Apr 2024", "Dec 2023 – Jan 2024". */
export function formatMonth(iso?: string): string {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  const monthIndex = Number(m) - 1;
  if (!y || Number.isNaN(monthIndex) || !MONTHS[monthIndex]) return iso;
  return `${MONTHS[monthIndex]} ${y}`;
}

export function formatTripDates(trip: Trip): string {
  const start = formatMonth(trip.startDate);
  const end = formatMonth(trip.endDate);
  if (!start && !end) return "Add dates";
  if (!end || end === start) return start || end;
  if (!start) return end;

  const startYear = trip.startDate?.slice(0, 4);
  const endYear = trip.endDate?.slice(0, 4);
  // Same year reads better without repeating it: "Mar – Apr 2024".
  if (startYear === endYear) return `${start.split(" ")[0]} – ${end}`;
  return `${start} – ${end}`;
}

/**
 * Convert a pre-trips record into one holding a single trip.
 *
 * Saved data predates the trip model, so a stored map is read through this rather
 * than assumed to be current — a returning user's countries, notes and photos all
 * survive the upgrade instead of silently resetting to the mock data.
 */
export function migrateVisited(raw: unknown): VisitedMap {
  if (!raw || typeof raw !== "object") return {};
  const out: VisitedMap = {};

  for (const [countryId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const record = value as Partial<VisitedCountry> & LegacyVisitedCountry;

    if (Array.isArray(record.trips)) {
      out[countryId] = { countryId, trips: record.trips };
      continue;
    }

    const photos = Array.isArray(record.photos) ? record.photos : [];
    const hadContent = photos.length > 0 || !!record.notes || !!record.visitedOn;
    out[countryId] = {
      countryId,
      trips: [
        {
          id: newId("trip"),
          // The legacy visitedOn was a full date; keep the month it fell in.
          startDate: record.visitedOn ? `${record.visitedOn.slice(0, 7)}-01` : undefined,
          notes: record.notes,
          photos,
        },
      ],
    };
    // A country marked visited with nothing else recorded still becomes a trip, so
    // it keeps its place on the map — just an empty one.
    if (!hadContent) out[countryId].trips[0].startDate = undefined;
  }

  return out;
}

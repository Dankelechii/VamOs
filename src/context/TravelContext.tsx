import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEFAULT_PROFILE, SAMPLE_VISITED } from "../data/mockData";
import { makeTrip, migrateVisited, newId } from "../data/trips";
import { WORLD_COUNTRIES } from "../data/worldCountries";
import { ChecklistItem, Photo, Trip, UserProfile, VisitedMap } from "../types";

// v2 is the trip-shaped payload. v1 (one record per country) is still read once and
// migrated forward, so upgrading the app doesn't wipe anyone's map.
const STORAGE_KEY_VISITED = "vamos:visited:v2";
const STORAGE_KEY_VISITED_LEGACY = "vamos:visited:v1";
const STORAGE_KEY_PROFILE = "vamos:profile:v1";
const STORAGE_KEY_CHECKLIST = "vamos:checklist:v1";
const TOTAL_COUNTRIES = WORLD_COUNTRIES.length;

interface TravelContextValue {
  loaded: boolean;
  profile: UserProfile;
  visited: VisitedMap;
  visitedCount: number;
  totalCountries: number;
  isVisited: (countryId: string) => boolean;
  /** Records a country as visited by starting its first trip. Returns that trip's id. */
  markVisited: (countryId: string) => string;
  /** Clears the country entirely — every trip to it. */
  unmarkVisited: (countryId: string) => void;
  addTrip: (countryId: string, patch?: Partial<Trip>) => string;
  updateTrip: (countryId: string, tripId: string, patch: Partial<Trip>) => void;
  /** Removes one trip; removing the last one clears the country. */
  removeTrip: (countryId: string, tripId: string) => void;
  addPhoto: (countryId: string, tripId: string, photo: Photo) => void;
  removePhoto: (countryId: string, tripId: string, photoId: string) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  /** Fills the map with example trips — never runs on its own. */
  loadSampleData: () => void;
  clearMap: () => void;

  checklist: ChecklistItem[];
  addChecklistItem: (text: string) => void;
  toggleChecklistItem: (id: string) => void;
  removeChecklistItem: (id: string) => void;
  clearCompletedChecklistItems: () => void;
}

// Shown once, on a device that has never had a list. They're the boring, easily
// forgotten things rather than a full packing list — the point is to give the feature
// a shape on first sight, and every one of them can be ticked off or deleted.
const STARTER_CHECKLIST: string[] = [
  "Check passport expiry date",
  "Look up visa requirements",
  "Travel insurance",
  "Tell the bank you're travelling",
  "Download offline maps",
];

const TravelContext = createContext<TravelContextValue | undefined>(undefined);

export function TravelProvider({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [visited, setVisited] = useState<VisitedMap>({});
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [storedVisited, legacyVisited, storedProfile, storedChecklist] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_VISITED),
          AsyncStorage.getItem(STORAGE_KEY_VISITED_LEGACY),
          AsyncStorage.getItem(STORAGE_KEY_PROFILE),
          AsyncStorage.getItem(STORAGE_KEY_CHECKLIST),
        ]);

        if (storedVisited) {
          setVisited(migrateVisited(JSON.parse(storedVisited)));
        } else if (legacyVisited) {
          const upgraded = migrateVisited(JSON.parse(legacyVisited));
          setVisited(upgraded);
          AsyncStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(upgraded)).catch(() => {});
        } else {
          // A brand-new install starts EMPTY. It used to fall back to the sample data,
          // which meant a first-time user opened the app to twelve countries they'd
          // never been to and a profile named after someone else. Sample trips are now
          // something you ask for, from Profile.
          //
          // The one exception is the shareable browser demo, which sets this global at
          // build time (geodata/inline_web_build.py) so the demo has something to show.
          // Nothing in the shipped app ever sets it.
          const isDemo = (globalThis as { __VAMOS_DEMO_SEED__?: boolean }).__VAMOS_DEMO_SEED__;
          setVisited(isDemo ? SAMPLE_VISITED : {});
        }

        setProfile(storedProfile ? JSON.parse(storedProfile) : DEFAULT_PROFILE);

        // An empty saved list is a real state — someone who ticked everything off and
        // cleared it shouldn't get the starter items pushed back at them on relaunch.
        setChecklist(
          storedChecklist
            ? JSON.parse(storedChecklist)
            : STARTER_CHECKLIST.map((text) => ({ id: newId("chk"), text, done: false }))
        );
      } catch (e) {
        // If storage fails for any reason, fall back to mock data so the app still works.
        setVisited({});
        setProfile(DEFAULT_PROFILE);
        setChecklist(STARTER_CHECKLIST.map((text) => ({ id: newId("chk"), text, done: false })));
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persistVisited = useCallback((next: VisitedMap) => {
    setVisited(next);
    AsyncStorage.setItem(STORAGE_KEY_VISITED, JSON.stringify(next)).catch(() => {});
  }, []);

  const persistProfile = useCallback((next: UserProfile) => {
    setProfile(next);
    AsyncStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(next)).catch(() => {});
  }, []);

  const isVisited = useCallback((countryId: string) => !!visited[countryId], [visited]);

  const addTrip = useCallback(
    (countryId: string, patch: Partial<Trip> = {}) => {
      const trip = makeTrip(patch);
      const existing = visited[countryId];
      persistVisited({
        ...visited,
        [countryId]: {
          countryId,
          trips: existing ? [...existing.trips, trip] : [trip],
        },
      });
      return trip.id;
    },
    [visited, persistVisited]
  );

  const markVisited = useCallback(
    (countryId: string) => {
      const existing = visited[countryId];
      if (existing && existing.trips.length > 0) return existing.trips[0].id;
      return addTrip(countryId);
    },
    [visited, addTrip]
  );

  const unmarkVisited = useCallback(
    (countryId: string) => {
      const next = { ...visited };
      delete next[countryId];
      persistVisited(next);
    },
    [visited, persistVisited]
  );

  const updateTrip = useCallback(
    (countryId: string, tripId: string, patch: Partial<Trip>) => {
      const existing = visited[countryId];
      if (!existing) return;
      persistVisited({
        ...visited,
        [countryId]: {
          ...existing,
          trips: existing.trips.map((t) => (t.id === tripId ? { ...t, ...patch } : t)),
        },
      });
    },
    [visited, persistVisited]
  );

  const removeTrip = useCallback(
    (countryId: string, tripId: string) => {
      const existing = visited[countryId];
      if (!existing) return;
      const trips = existing.trips.filter((t) => t.id !== tripId);
      if (trips.length === 0) {
        // No trips left means the country was never really visited — drop it from
        // the map rather than leaving an empty record behind inflating the count.
        const next = { ...visited };
        delete next[countryId];
        persistVisited(next);
        return;
      }
      persistVisited({ ...visited, [countryId]: { ...existing, trips } });
    },
    [visited, persistVisited]
  );

  const addPhoto = useCallback(
    (countryId: string, tripId: string, photo: Photo) => {
      const existing = visited[countryId];
      if (!existing) return;
      persistVisited({
        ...visited,
        [countryId]: {
          ...existing,
          trips: existing.trips.map((t) =>
            t.id === tripId ? { ...t, photos: [...t.photos, photo] } : t
          ),
        },
      });
    },
    [visited, persistVisited]
  );

  const removePhoto = useCallback(
    (countryId: string, tripId: string, photoId: string) => {
      const existing = visited[countryId];
      if (!existing) return;
      persistVisited({
        ...visited,
        [countryId]: {
          ...existing,
          trips: existing.trips.map((t) =>
            t.id === tripId ? { ...t, photos: t.photos.filter((p) => p.id !== photoId) } : t
          ),
        },
      });
    },
    [visited, persistVisited]
  );

  const updateProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      persistProfile({ ...profile, ...patch });
    },
    [profile, persistProfile]
  );

  /** Fills the map with example trips, for someone who wants to look around first. */
  const loadSampleData = useCallback(() => {
    persistVisited(SAMPLE_VISITED);
  }, [persistVisited]);

  const clearMap = useCallback(() => {
    persistVisited({});
  }, [persistVisited]);

  const persistChecklist = useCallback((next: ChecklistItem[]) => {
    setChecklist(next);
    AsyncStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(next)).catch(() => {});
  }, []);

  const addChecklistItem = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      // Newest at the top: the thing you just thought of is the thing you're looking at.
      persistChecklist([{ id: newId("chk"), text: trimmed, done: false }, ...checklist]);
    },
    [checklist, persistChecklist]
  );

  const toggleChecklistItem = useCallback(
    (id: string) => {
      persistChecklist(checklist.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    },
    [checklist, persistChecklist]
  );

  const removeChecklistItem = useCallback(
    (id: string) => {
      persistChecklist(checklist.filter((i) => i.id !== id));
    },
    [checklist, persistChecklist]
  );

  const clearCompletedChecklistItems = useCallback(() => {
    persistChecklist(checklist.filter((i) => !i.done));
  }, [checklist, persistChecklist]);

  const value = useMemo<TravelContextValue>(
    () => ({
      loaded,
      profile,
      visited,
      visitedCount: Object.keys(visited).length,
      totalCountries: TOTAL_COUNTRIES,
      isVisited,
      markVisited,
      unmarkVisited,
      addTrip,
      updateTrip,
      removeTrip,
      addPhoto,
      removePhoto,
      updateProfile,
      loadSampleData,
      clearMap,
      checklist,
      addChecklistItem,
      toggleChecklistItem,
      removeChecklistItem,
      clearCompletedChecklistItems,
    }),
    [
      loaded,
      profile,
      visited,
      isVisited,
      markVisited,
      unmarkVisited,
      addTrip,
      updateTrip,
      removeTrip,
      addPhoto,
      removePhoto,
      updateProfile,
      loadSampleData,
      clearMap,
      checklist,
      addChecklistItem,
      toggleChecklistItem,
      removeChecklistItem,
      clearCompletedChecklistItems,
    ]
  );

  return <TravelContext.Provider value={value}>{children}</TravelContext.Provider>;
}

export function useTravel() {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error("useTravel must be used within a TravelProvider");
  return ctx;
}

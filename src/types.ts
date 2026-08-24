export interface Photo {
  id: string;
  uri: string;
  caption?: string;
  takenAt?: string; // ISO date string
}

/**
 * One visit to a country. A country can hold several — going back somewhere is a
 * different trip with its own dates, notes and photos, not an edit of the old one.
 *
 * Dates are stored as ISO `YYYY-MM-01` and are month-precision by design: for a
 * travel log "March 2024" is the useful granularity, and asking for an exact day
 * makes the input worse without making the record better.
 */
export interface Trip {
  id: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  photos: Photo[];
}

export interface VisitedCountry {
  countryId: string; // matches CountryGeo.id (ISO 3166-1 numeric, zero-padded)
  trips: Trip[];
}

export type VisitedMap = Record<string, VisitedCountry>;

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  avatarEmoji: string;
  avatarColor: string;
  bio?: string;
  instagramHandle?: string;
}

export interface Friend extends UserProfile {
  visited: VisitedMap;
}

/**
 * One line on the travel checklist.
 *
 * Deliberately not tied to a country or a trip: the things that actually go on a
 * pre-travel list ("renew passport", "book airport parking") mostly belong to the
 * person rather than to any one destination, and making every item pick a country
 * first would be friction on the one screen that should be quick to jot into.
 */
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

/** The pre-trips storage shape, kept only so saved data can be migrated. */
export interface LegacyVisitedCountry {
  countryId: string;
  visitedOn?: string;
  notes?: string;
  photos?: Photo[];
}

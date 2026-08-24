import { Friend, LegacyVisitedCountry, Trip, UserProfile, VisitedMap } from "../types";
import { makeTrip, migrateVisited } from "./trips";

// Country IDs are ISO 3166-1 numeric (zero-padded), matching src/data/worldCountries.ts
const C = {
  France: "250",
  Spain: "724",
  Italy: "380",
  Portugal: "620",
  Japan: "392",
  Thailand: "764",
  Vietnam: "704",
  UnitedStates: "840",
  Mexico: "484",
  Peru: "604",
  Morocco: "504",
  Egypt: "818",
  Greece: "300",
  Iceland: "352",
  Norway: "578",
  Croatia: "191",
  Indonesia: "360",
  NewZealand: "554",
  Australia: "036",
  SouthKorea: "410",
  India: "356",
  SriLanka: "144",
  Netherlands: "528",
  Germany: "276",
  Switzerland: "756",
  Austria: "040",
  Turkey: "792",
  UnitedKingdom: "826",
  Ireland: "372",
  Canada: "124",
  Brazil: "076",
  Argentina: "032",
  Chile: "152",
  SouthAfrica: "710",
  Kenya: "404",
  Tanzania: "834",
  Jordan: "400",
  UAE: "784",
  Philippines: "608",
  Malaysia: "458",
  China: "156",
  Cambodia: "116",
  Laos: "418",
  Colombia: "170",
  CostaRica: "188",
  Cuba: "192",
  CzechRepublic: "203",
  Hungary: "348",
  Poland: "616",
};

// Sample trips carry dates and notes but deliberately no photos. They used to point at
// random picsum.photos images, which meant shipping internet stock presented as the
// user's own travel pictures — placeholder content, and a network dependency for
// something that should be purely local. Photos now only ever come from the camera roll.

// What a brand-new install starts as. Nobody is called "Dan" by default — the name and
// handle are the user's to set on the Profile screen.
export const DEFAULT_PROFILE: UserProfile = {
  id: "me",
  name: "Traveller",
  handle: "@traveller",
  avatarEmoji: "🧭",
  avatarColor: "#DDA83F",
};

// Deliberately still written in the pre-trips shape and run through the real
// migration below: it keeps the sample data readable, and it means the migration
// path is exercised on every launch rather than only by users upgrading.
const SAMPLE_LEGACY: Record<string, LegacyVisitedCountry> = {
  [C.France]: {
    countryId: C.France,
    visitedOn: "2023-06-10",
    notes: "Road trip through Provence, ended in Paris.",
    photos: [],
  },
  [C.Spain]: {
    countryId: C.Spain,
    visitedOn: "2022-09-02",
    notes: "Barcelona + a few days in Granada.",
    photos: [],
  },
  [C.Italy]: {
    countryId: C.Italy,
    visitedOn: "2022-05-18",
    photos: [],
  },
  [C.Japan]: {
    countryId: C.Japan,
    visitedOn: "2024-04-02",
    notes: "Cherry blossom season in Kyoto and Tokyo.",
    photos: [],
  },
  [C.Thailand]: {
    countryId: C.Thailand,
    visitedOn: "2019-12-20",
    photos: [],
  },
  [C.UnitedStates]: {
    countryId: C.UnitedStates,
    visitedOn: "2021-08-01",
    photos: [],
  },
  [C.Morocco]: {
    countryId: C.Morocco,
    visitedOn: "2023-10-14",
    notes: "Marrakech medina + a night in the Sahara.",
    photos: [],
  },
  [C.Iceland]: {
    countryId: C.Iceland,
    visitedOn: "2023-02-11",
    photos: [],
  },
  [C.Portugal]: {
    countryId: C.Portugal,
    visitedOn: "2021-07-05",
    photos: [],
  },
  [C.Greece]: {
    countryId: C.Greece,
    visitedOn: "2020-08-19",
    photos: [],
  },
  [C.Indonesia]: {
    countryId: C.Indonesia,
    visitedOn: "2019-03-05",
    photos: [],
  },
  [C.UnitedKingdom]: {
    countryId: C.UnitedKingdom,
    visitedOn: "2024-11-01",
    photos: [],
  },
};

/**
 * Second and third visits, added on top of the migrated single-trip records.
 * The point of the trip model is that going back somewhere is its own entry, so the
 * sample data has to actually show that or the feature is invisible.
 */
function withRepeatVisits(base: VisitedMap): VisitedMap {
  const extra: Record<string, Partial<Trip>[]> = {
    [C.Japan]: [
      {
        title: "Winter in Hokkaido",
        startDate: "2019-01-01",
        endDate: "2019-02-01",
        notes: "Powder snow in Niseko, ramen in Sapporo. Went back for the blossoms five years later.",
        photos: [],
      },
    ],
    [C.Italy]: [
      {
        title: "Dolomites hiking",
        startDate: "2024-09-01",
        notes: "Completely different country up north.",
        photos: [],
      },
    ],
    [C.France]: [
      {
        title: "Paris, first time",
        startDate: "2016-11-01",
        notes: "Four days, no plan, mostly walking.",
        photos: [],
      },
    ],
  };

  const out: VisitedMap = { ...base };
  for (const [countryId, trips] of Object.entries(extra)) {
    const record = out[countryId];
    if (!record) continue;
    out[countryId] = {
      ...record,
      trips: [...record.trips, ...trips.map((t) => makeTrip(t))],
    };
  }
  return out;
}

export const SAMPLE_VISITED: VisitedMap = withRepeatVisits(migrateVisited(SAMPLE_LEGACY));


function friend(
  id: string,
  name: string,
  handle: string,
  emoji: string,
  color: string,
  bio: string,
  trips: { id: string; on: string; note?: string }[]
): Friend {
  const visited: VisitedMap = {};
  trips.forEach((c) => {
    const trip = makeTrip({
      startDate: `${c.on.slice(0, 7)}-01`,
      notes: c.note,
      photos: [],
    });
    // Listing the same country twice means two trips, not an overwrite.
    const existing = visited[c.id];
    visited[c.id] = {
      countryId: c.id,
      trips: existing ? [...existing.trips, trip] : [trip],
    };
  });
  return { id, name, handle, avatarEmoji: emoji, avatarColor: color, bio, visited };
}

export const MOCK_FRIENDS: Friend[] = [
  friend(
    "f1",
    "Priya Shah",
    "@priyatravels",
    "🌏",
    "#3DDC97",
    "Collecting sunsets on every continent.",
    [
      { id: C.India, on: "2023-01-10" },
      { id: C.SriLanka, on: "2023-01-20" },
      { id: C.Vietnam, on: "2022-11-02" },
      { id: C.Cambodia, on: "2022-11-10" },
      { id: C.Laos, on: "2022-11-15" },
      { id: C.Australia, on: "2021-12-01" },
      { id: C.NewZealand, on: "2021-12-15" },
    ]
  ),
  friend(
    "f2",
    "Leo Martins",
    "@leo.wanders",
    "🏔️",
    "#FFC857",
    "Mountains, mostly. Also tacos.",
    [
      { id: C.Peru, on: "2022-06-01" },
      { id: C.Chile, on: "2022-06-10" },
      { id: C.Argentina, on: "2022-06-18" },
      { id: C.Brazil, on: "2022-07-01" },
      { id: C.Mexico, on: "2020-02-01" },
      { id: C.CostaRica, on: "2019-09-01" },
    ]
  ),
  friend(
    "f3",
    "Amara Okafor",
    "@amaraexplores",
    "🦁",
    "#FF6B4A",
    "Safari season is my favorite season.",
    [
      { id: C.Kenya, on: "2023-08-01" },
      { id: C.Tanzania, on: "2023-08-10" },
      { id: C.SouthAfrica, on: "2023-08-20" },
      { id: C.Jordan, on: "2022-04-01" },
      { id: C.Egypt, on: "2022-04-10" },
      { id: C.UAE, on: "2021-12-05" },
      { id: C.Morocco, on: "2021-03-01" },
    ]
  ),
  friend(
    "f4",
    "Sofia Bergqvist",
    "@sofia.b",
    "❄️",
    "#7DD3FC",
    "Nordic light and everything after.",
    [
      { id: C.Norway, on: "2023-01-05" },
      { id: C.Iceland, on: "2022-10-01" },
      { id: C.Germany, on: "2021-12-20" },
      { id: C.Austria, on: "2021-12-27" },
      { id: C.Switzerland, on: "2021-07-01" },
      { id: C.CzechRepublic, on: "2020-09-01" },
      { id: C.Hungary, on: "2020-09-05" },
      { id: C.Poland, on: "2020-09-10" },
      { id: C.Netherlands, on: "2019-05-01" },
      { id: C.Croatia, on: "2019-07-01" },
    ]
  ),
  friend(
    "f5",
    "Kenji Watanabe",
    "@kenji.eats",
    "🍜",
    "#C084FC",
    "I plan trips around noodles.",
    [
      { id: C.SouthKorea, on: "2023-05-01" },
      { id: C.China, on: "2022-10-01" },
      { id: C.Malaysia, on: "2022-03-01" },
      { id: C.Philippines, on: "2021-11-01" },
      { id: C.Thailand, on: "2020-01-01" },
      { id: C.Thailand, on: "2023-02-01", note: "Back for Chiang Mai this time." },
      { id: C.SouthKorea, on: "2019-10-01" },
    ]
  ),
];

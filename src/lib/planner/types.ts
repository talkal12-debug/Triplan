import { z } from "zod";
import { placeTags } from "@/lib/data/schemas";

/**
 * TripPreferences: everything the wizard collects. Pure data, validated with Zod,
 * shared by the wizard (milestone 3), the planning engine (4) and the DB (Trip.preferences).
 *
 * Every field has a sensible default so any step can be skipped.
 */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM");

export const destinationSchema = z.object({
  countryCode: z.string().length(2),
  /** City/area slugs from the seed (e.g. "lisbon", "porto"). Empty = let the planner choose. */
  cities: z.array(z.string()).max(6).default([]),
});
export type Destination = z.infer<typeof destinationSchema>;

export const datesSchema = z.object({
  start: isoDate,
  /** Number of trip days including arrival and departure days. */
  days: z.number().int().min(1).max(30),
  arrivalTime: hhmm.nullable().default(null),
  departureTime: hhmm.nullable().default(null),
});

export const partySchema = z
  .object({
    adults: z.number().int().min(1).max(20),
    /** Exact ages of children (2-17). */
    childrenAges: z.array(z.number().int().min(2).max(17)).max(10),
    /** Under 2 years old. */
    infants: z.number().int().min(0).max(5),
    stroller: z.boolean(),
    /** Travellers aged 65+. Counted within adults. */
    seniors: z.number().int().min(0).max(20),
  })
  .refine((p) => p.seniors <= p.adults, { message: "seniors are counted within adults", path: ["seniors"] });

export const visitNumbers = [1, 2, 3] as const; // 3 = third time or more
export const efforts = ["low", "medium", "high"] as const;
export type Effort = (typeof efforts)[number];
export const accessibilityNeeds = ["wheelchair", "stroller", "stairs", "altitude"] as const;
export type AccessibilityNeed = (typeof accessibilityNeeds)[number];
export const transportModes = ["walk", "bike", "car", "transit", "tours"] as const;
export type TransportMode = (typeof transportModes)[number];
export const budgetLevels = ["budget", "mid", "luxury"] as const;
export type BudgetLevel = (typeof budgetLevels)[number];
export const hotelTypes = ["hostel", "3star", "4star", "5star", "apartment", "boutique", "camping"] as const;
export type HotelType = (typeof hotelTypes)[number];
export const locationPrefs = ["center", "station", "beach", "quiet"] as const;
export type LocationPref = (typeof locationPrefs)[number];
export const baseModes = ["single", "multi", "auto"] as const;
export type BaseMode = (typeof baseModes)[number];
export const currencies = ["ILS", "USD", "EUR", "GBP", "JPY"] as const;

/** The 13 interests offered in the wizard (subset of placeTags). */
export const interests = [
  "nature",
  "city",
  "history",
  "food",
  "wine",
  "museums",
  "beaches",
  "adventure",
  "nightlife",
  "shopping",
  "photography",
  "religion",
  "kids",
] as const satisfies readonly (typeof placeTags)[number][];
export type Interest = (typeof interests)[number];

/** 0 = never, 1 = a little, 2 = normal, 3 = prefer */
export const transportWeight = z.number().int().min(0).max(3);

export const tripPreferencesSchema = z.object({
  version: z.literal(1),
  destinations: z.array(destinationSchema).min(1).max(3),
  dates: datesSchema,
  party: partySchema,
  visitNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Free text from returning visitors: "saw the Colosseum and the Vatican". */
  alreadySeenNotes: z.string().max(2000),
  /** Place ids marked as already seen (filled in from the plan view later). */
  alreadySeen: z.array(z.string()),
  effort: z.enum(efforts),
  accessibility: z.array(z.enum(accessibilityNeeds)),
  transport: z.object({
    walk: transportWeight,
    bike: transportWeight,
    car: transportWeight,
    transit: transportWeight,
    tours: transportWeight,
  }),
  carOptions: z.object({
    oppositeSideOk: z.boolean(),
    avoidMountainRoads: z.boolean(),
    avoidCityDriving: z.boolean(),
  }),
  /** Selected interests, in priority order. The first three are the ranked ones. */
  interests: z.array(z.enum(interests)).max(13),
  budget: z.object({
    level: z.enum(budgetLevels),
    dailyCap: z.number().int().positive().max(100000).nullable(),
    currency: z.enum(currencies),
  }),
  hotel: z.object({
    type: z.enum(hotelTypes),
    locationPref: z.enum(locationPrefs),
    baseMode: z.enum(baseModes),
  }),
});
export type TripPreferences = z.infer<typeof tripPreferencesSchema>;

/** Same shape, but a draft may still have no destination (wizard in progress). */
export const tripDraftSchema = tripPreferencesSchema.extend({
  destinations: z.array(destinationSchema).max(3),
});

/** A trip starting ~6 weeks from today: far enough to plan, close enough to feel real. */
export function defaultStartDate(today = new Date()): string {
  const d = new Date(today);
  d.setDate(d.getDate() + 42);
  return d.toISOString().slice(0, 10);
}

export function defaultTripPreferences(today = new Date()): TripPreferences {
  return {
    version: 1,
    destinations: [],
    dates: { start: defaultStartDate(today), days: 7, arrivalTime: null, departureTime: null },
    party: { adults: 2, childrenAges: [], infants: 0, stroller: false, seniors: 0 },
    visitNumber: 1,
    alreadySeenNotes: "",
    alreadySeen: [],
    effort: "medium",
    accessibility: [],
    transport: { walk: 3, bike: 0, car: 0, transit: 2, tours: 1 },
    carOptions: { oppositeSideOk: true, avoidMountainRoads: false, avoidCityDriving: false },
    interests: ["city", "history", "food"],
    budget: { level: "mid", dailyCap: null, currency: "ILS" },
    hotel: { type: "4star", locationPref: "center", baseMode: "auto" },
  };
}

/** Walking distance targets per day, in km. */
export const effortKmPerDay: Record<Effort, { min: number; max: number }> = {
  low: { min: 1, max: 4 },
  medium: { min: 6, max: 12 },
  high: { min: 12, max: 20 },
};

export function tripEndDate(dates: { start: string; days: number }): string {
  const d = new Date(`${dates.start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dates.days - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Single base with star-shaped day trips vs moving between hotels.
 * Heuristic used when the traveller answers "not sure".
 */
export function recommendBaseMode(prefs: Pick<TripPreferences, "destinations" | "dates" | "party">): {
  mode: Exclude<BaseMode, "auto">;
  reason: "short" | "one_city" | "many_cities" | "many_countries" | "long" | "small_kids";
} {
  const cities = prefs.destinations.reduce((n, d) => n + Math.max(d.cities.length, 1), 0);
  const smallKids = prefs.party.infants > 0 || prefs.party.childrenAges.some((a) => a < 6);
  if (prefs.destinations.length > 1) return { mode: "multi", reason: "many_countries" };
  if (prefs.dates.days <= 4) return { mode: "single", reason: "short" };
  if (cities >= 3) return { mode: "multi", reason: "many_cities" };
  if (smallKids) return { mode: "single", reason: "small_kids" };
  if (cities === 1) return { mode: "single", reason: "one_city" };
  return prefs.dates.days >= 8 ? { mode: "multi", reason: "long" } : { mode: "single", reason: "one_city" };
}

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Meteorological season for a date at a latitude (southern hemisphere flips). */
export function seasonFor(date: string, lat: number): Season {
  const month = Number(date.slice(5, 7));
  const north: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
  const south: Season[] = ["summer", "summer", "autumn", "autumn", "autumn", "winter", "winter", "winter", "spring", "spring", "spring", "summer"];
  return (lat < 0 ? south : north)[month - 1];
}

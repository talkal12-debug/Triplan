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

/** A city/area picked from OpenStreetMap for countries without a curated seed. */
export const customCitySchema = z.object({
  slug: z.string().min(1),
  names: z.object({ en: z.string().min(1), he: z.string().optional(), local: z.string().optional() }).catchall(z.string()),
  center: z.object({ lat: z.number(), lng: z.number() }),
  /** [south, west, north, east] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});
export type CustomCity = z.infer<typeof customCitySchema>;

export const destinationSchema = z.object({
  countryCode: z.string().length(2),
  /** City/area slugs from the seed (e.g. "lisbon", "porto") or of customCities. Empty = let the planner choose. */
  cities: z.array(z.string()).max(6).default([]),
  /** Full records for OSM-sourced cities (the seed knows its own). Absent for demo countries. */
  customCities: z.array(customCitySchema).max(6).optional(),
});
export type Destination = z.infer<typeof destinationSchema>;

export const datesSchema = z.object({
  start: isoDate,
  /** Number of trip days including arrival and departure days. */
  days: z.number().int().min(1).max(30),
  arrivalTime: hhmm.nullable().default(null),
  departureTime: hhmm.nullable().default(null),
  /** City the traveller flies from (free text). Empty = the flight sites ask. */
  origin: z.string().max(80).optional(),
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

/**
 * Named travellers (family profiles). The planner still reads `party` and
 * `accessibility`; both are derived from these rows whenever they exist, so old
 * drafts with counts only keep working and the plan view can say which day is
 * heavy for whom.
 */
export const travelerKinds = ["adult", "senior", "child", "infant"] as const;
export type TravelerKind = (typeof travelerKinds)[number];
export const travelerNeeds = ["lowWalking", "wheelchair", "stroller", "stairs", "altitude", "naps"] as const;
export type TravelerNeed = (typeof travelerNeeds)[number];
export const travelerSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().max(40).default(""),
  kind: z.enum(travelerKinds),
  /** Children only (2-17); null for the others. */
  age: z.number().int().min(0).max(120).nullable().default(null),
  needs: z.array(z.enum(travelerNeeds)).max(6).default([]),
});
export type Traveler = z.infer<typeof travelerSchema>;

/** Which needs make sense to ask for a given traveller. */
export function needsFor(tr: Pick<Traveler, "kind" | "age">): TravelerNeed[] {
  switch (tr.kind) {
    case "infant":
      return ["stroller"];
    case "child":
      return (tr.age ?? 8) < 6 ? ["stroller", "naps", "lowWalking", "stairs"] : ["lowWalking", "stairs", "altitude"];
    case "senior":
      return ["lowWalking", "wheelchair", "stairs", "altitude"];
    default:
      return ["lowWalking", "wheelchair", "stairs", "altitude"];
  }
}

export function partyFromTravelers(travelers: Traveler[]): z.infer<typeof partySchema> {
  const adults = travelers.filter((t) => t.kind === "adult" || t.kind === "senior").length;
  return {
    adults: Math.max(1, Math.min(20, adults)),
    seniors: Math.min(travelers.filter((t) => t.kind === "senior").length, Math.max(1, adults)),
    childrenAges: travelers.filter((t) => t.kind === "child").map((t) => Math.min(17, Math.max(2, t.age ?? 8))).slice(0, 10),
    infants: Math.min(5, travelers.filter((t) => t.kind === "infant").length),
    stroller: travelers.some((t) => t.needs.includes("stroller")),
  };
}

export function accessibilityFromTravelers(travelers: Traveler[]): AccessibilityNeed[] {
  const out = new Set<AccessibilityNeed>();
  for (const t of travelers) for (const n of t.needs) if ((accessibilityNeeds as readonly string[]).includes(n)) out.add(n as AccessibilityNeed);
  return [...out];
}

/** Rows for a draft that only has counts (made before family profiles existed). */
export function travelersFromParty(party: z.infer<typeof partySchema>): Traveler[] {
  const rows: Traveler[] = [];
  for (let i = 0; i < party.seniors; i++) rows.push({ id: `senior-${i}`, name: "", kind: "senior", age: null, needs: [] });
  for (let i = 0; i < party.adults - party.seniors; i++) rows.push({ id: `adult-${i}`, name: "", kind: "adult", age: null, needs: [] });
  party.childrenAges.forEach((age, i) => rows.push({ id: `child-${i}`, name: "", kind: "child", age, needs: party.stroller && age < 5 ? ["stroller"] : [] }));
  for (let i = 0; i < party.infants; i++) rows.push({ id: `infant-${i}`, name: "", kind: "infant", age: null, needs: party.stroller ? ["stroller"] : [] });
  return rows;
}

/** Trip style: sightseeing days ("explore") or a beach-and-hotel holiday with a few outings ("relax"). */
export const tripStyles = ["explore", "relax"] as const;
export type TripStyle = (typeof tripStyles)[number];

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
  "attractions",
] as const satisfies readonly (typeof placeTags)[number][];
export type Interest = (typeof interests)[number];

/** How the traveller likes to spend evenings; drives the evening suggestions (milestone 11). */
export const eveningStyles = ["quiet", "culture", "nightlife", "none"] as const;
export type EveningStyle = (typeof eveningStyles)[number];

/** Kinds of ticketed events wanted in the evenings (interests step). Empty = anything goes. */
export const eventTypes = ["concert", "musical", "theatre", "comedy", "classical", "dance", "sports", "family"] as const;
export type EventType = (typeof eventTypes)[number];

/**
 * A place the traveller insists on. `placeId` is set when picked from our catalogue;
 * a free-text entry is resolved at planning time (catalogue name match, then OpenStreetMap).
 */
export const mustVisitSchema = z.object({
  name: z.string().trim().min(1).max(120),
  placeId: z.string().nullable(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type MustVisit = z.infer<typeof mustVisitSchema>;

/** 0 = never, 1 = a little, 2 = normal, 3 = prefer */
export const transportWeight = z.number().int().min(0).max(3);

export const tripPreferencesSchema = z.object({
  version: z.literal(1),
  destinations: z.array(destinationSchema).min(1).max(3),
  dates: datesSchema,
  party: partySchema,
  /** Named travellers; `party` and `accessibility` are derived from them when present. */
  travelers: z.array(travelerSchema).max(20).default([]),
  visitNumber: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Free text from returning visitors: "saw the Colosseum and the Vatican". */
  alreadySeenNotes: z.string().max(2000),
  /** Place ids marked as already seen (filled in from the plan view later). */
  alreadySeen: z.array(z.string()),
  effort: z.enum(efforts),
  /** Added with the beach holiday mode; older drafts are sightseeing trips. */
  tripStyle: z.enum(tripStyles).default("explore"),
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
  interests: z.array(z.enum(interests)).max(14),
  /** Places the traveller wants no matter what (wishlist step). Added in milestone 11; older drafts have none. */
  mustVisit: z.array(mustVisitSchema).max(20).default([]),
  /** Evening style (interests step). Added in milestone 11. */
  evening: z.enum(eveningStyles).default("quiet"),
  /** Preferred event kinds; preferred ones come first and are marked. Empty = all. Added with the Ticketmaster key. */
  eventTypes: z.array(z.enum(eventTypes)).max(8).default([]),
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
    dates: { start: defaultStartDate(today), days: 7, arrivalTime: null, departureTime: null, origin: "" },
    party: { adults: 2, childrenAges: [], infants: 0, stroller: false, seniors: 0 },
    travelers: [],
    visitNumber: 1,
    alreadySeenNotes: "",
    alreadySeen: [],
    effort: "medium",
    tripStyle: "explore",
    accessibility: [],
    transport: { walk: 3, bike: 0, car: 0, transit: 2, tours: 1 },
    carOptions: { oppositeSideOk: true, avoidMountainRoads: false, avoidCityDriving: false },
    interests: ["city", "history", "food"],
    mustVisit: [],
    evening: "quiet",
    eventTypes: [],
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

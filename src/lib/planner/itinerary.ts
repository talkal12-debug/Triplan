import { z } from "zod";
import { citySeedSchema, placeSeedSchema, type PlaceSeed } from "@/lib/data/schemas";

/**
 * Itinerary: the planner's output. Pure data, serialisable, Zod-validated.
 * Days -> activities. Every activity carries structured reasons the UI translates.
 */

/** The planner works on the seed shape directly; alias keeps the engine decoupled by name. */
export type PlannerPlace = PlaceSeed;
export const plannerPlaceSchema = placeSeedSchema;
export type PlannerCity = z.infer<typeof citySeedSchema>;

export const travelModes = ["walk", "bike", "car", "transit"] as const;
export type TravelMode = (typeof travelModes)[number];

export const transitSchema = z.object({
  mode: z.enum(travelModes),
  minutes: z.number().int().min(0),
  meters: z.number().int().min(0),
  /** true until a routing provider (OSRM) replaces the straight-line estimate */
  estimated: z.boolean(),
});
export type Transit = z.infer<typeof transitSchema>;

/** Structured explanation. `params` feeds the translated message. */
export const reasonSchema = z.object({
  code: z.enum([
    "near_base",
    "near_previous",
    "interest_match",
    "iconic_first_visit",
    "hidden_gem_returning",
    "kid_friendly",
    "open_on_day",
    "indoor_rain",
    "lunch_time",
    "rest_break",
    "advance_booking",
    "unverified_hours",
    "half_day_arrival",
    "half_day_departure",
    "day_trip",
    "hotel_transfer",
  ]),
  params: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});
export type Reason = z.infer<typeof reasonSchema>;

export const warningSchema = z.object({
  code: z.enum([
    "closed_on_date",
    "unverified_data",
    "day_too_full",
    "day_too_light",
    "base_too_far",
    "city_dropped",
    "no_places",
    "holiday",
    "rain_expected",
    "advance_booking_needed",
    "walk_budget_tight",
    "few_places_left",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  params: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  /** Where the warning applies; absent = whole trip. */
  dayIndex: z.number().int().min(0).optional(),
  placeId: z.string().optional(),
});
export type Warning = z.infer<typeof warningSchema>;

export const activityKinds = ["visit", "meal", "rest", "hotel_checkin", "hotel_checkout", "free"] as const;

export const activitySchema = z.object({
  id: z.string(),
  kind: z.enum(activityKinds),
  placeId: z.string().nullable(),
  /** minutes from midnight, local time */
  startMin: z.number().int().min(0).max(1440),
  endMin: z.number().int().min(0).max(1500),
  locked: z.boolean(),
  reasons: z.array(reasonSchema),
  transitFromPrev: transitSchema.nullable(),
  dataQuality: z.enum(["verified", "partial", "unverified"]).nullable(),
});
export type Activity = z.infer<typeof activitySchema>;

export const dayKinds = ["arrival", "full", "departure", "arrival_departure"] as const;
export type DayKind = (typeof dayKinds)[number];

export const dayStatsSchema = z.object({
  walkKm: z.number(),
  activeMinutes: z.number().int(),
  transitMinutes: z.number().int(),
  /** 0..1 share of the day's active budget used */
  load: z.number(),
  intensity: z.enum(["light", "moderate", "heavy"]),
  museums: z.number().int(),
  outdoorShare: z.number(),
  elevationM: z.number().nullable(),
});
export type DayStats = z.infer<typeof dayStatsSchema>;

export const itineraryDaySchema = z.object({
  index: z.number().int().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(dayKinds),
  stayId: z.string(),
  citySlug: z.string(),
  /** Cluster ids visited today (1 or 2). */
  clusterIds: z.array(z.string()),
  /** Dominant tag, for variety and for the UI headline. */
  theme: z.string().nullable(),
  activities: z.array(activitySchema),
  rainPlan: z.array(z.string()),
  stats: dayStatsSchema,
  warnings: z.array(warningSchema),
});
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;

export const staySchema = z.object({
  id: z.string(),
  citySlug: z.string(),
  countryCode: z.string().length(2),
  /** Inclusive day indexes. */
  fromDay: z.number().int().min(0),
  toDay: z.number().int().min(0),
  center: z.object({ lat: z.number(), lng: z.number() }),
  locationPref: z.string(),
});
export type Stay = z.infer<typeof staySchema>;

export const itinerarySchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  baseMode: z.enum(["single", "multi"]),
  stays: z.array(staySchema).min(1),
  days: z.array(itineraryDaySchema).min(1),
  warnings: z.array(warningSchema),
  stats: z.object({
    totalWalkKm: z.number(),
    places: z.number().int(),
    verifiedShare: z.number(),
  }),
});
export type Itinerary = z.infer<typeof itinerarySchema>;

/** Optional external signals. Milestone 6 fills them from Open-Meteo / Nager.Date. */
export type DayWeather = { precipProbability: number; tempMax: number | null };
export type Holiday = { date: string; name: string };

export type PlannerInput = {
  prefs: import("./types").TripPreferences;
  places: PlannerPlace[];
  cities: PlannerCity[];
  weather?: Record<string, DayWeather>;
  holidays?: Holiday[];
  /** Deterministic tie-breaking; defaults to a fixed seed. */
  seed?: number;
};

import { z } from "zod";

/**
 * Zod schemas for the committed data files (data/*.json) and for the
 * JSON-encoded String columns in Prisma. Single source of truth for
 * enum-like values: keep these lists in sync with PLAN.md.
 */

export const placeCategories = [
  "landmark",
  "museum",
  "gallery",
  "viewpoint",
  "park",
  "garden",
  "beach",
  "market",
  "neighborhood",
  "church",
  "shrine",
  "temple",
  "palace",
  "castle",
  "monument",
  "square",
  "bridge",
  "tower",
  "waterfront",
  "aquarium",
  "zoo",
  "theme_park",
  "shopping",
  "food",
  "nightlife",
  "nature",
  "day_trip",
] as const;
export type PlaceCategory = (typeof placeCategories)[number];

/** Interest tags. The first 13 and `attractions` mirror the wizard's interest list. */
export const placeTags = [
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
  "architecture",
  "art",
  "views",
  "walking",
  "local",
  "hidden",
  "free",
  "iconic",
  "science",
  "jewish",
  "attractions",
] as const;
export type PlaceTag = (typeof placeTags)[number];

export const dataQualities = ["verified", "partial", "unverified"] as const;
export type DataQuality = (typeof dataQualities)[number];

export const wheelchairValues = ["yes", "limited", "no", "unknown"] as const;

export const localizedNamesSchema = z
  .object({
    en: z.string().min(1),
    he: z.string().min(1).optional(),
    local: z.string().min(1).optional(),
  })
  .catchall(z.string());
export type LocalizedNames = z.infer<typeof localizedNamesSchema>;

export const currencySchema = z.object({
  code: z.string().length(3),
  name: z.string(),
  symbol: z.string(),
});

export const countrySchema = z.object({
  code: z.string().length(2),
  code3: z.string().length(3),
  names: localizedNamesSchema,
  flag: z.string().min(1),
  currencies: z.array(currencySchema),
  languages: z.array(z.string()),
  drivingSide: z.enum(["left", "right"]),
  callingCode: z.string(),
  timezones: z.array(z.string()),
  capital: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  region: z.string(),
  subregion: z.string().nullable(),
});
export type Country = z.infer<typeof countrySchema>;
export const countriesFileSchema = z.array(countrySchema);

/** One seeded point of interest, as stored in data/pois/{cc}.json. */
export const placeSeedSchema = z.object({
  id: z.string().regex(/^[a-z]{2}-[a-z0-9-]+$/, "id must look like pt-lisbon-torre-de-belem"),
  externalId: z.string().nullable(),
  countryCode: z.string().length(2),
  city: z.string().min(1),
  nameLocal: z.string().min(1),
  names: localizedNamesSchema,
  category: z.enum(placeCategories),
  tags: z.array(z.enum(placeTags)).min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  elevationM: z.number().nullable(),
  openingHours: z.string().nullable(),
  closedDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  visitMinutes: z.number().int().min(10).max(600),
  iconicity: z.number().min(0).max(1),
  minAge: z.number().int().min(0).nullable(),
  wheelchair: z.enum(wheelchairValues),
  strollerOk: z.boolean().nullable(),
  priceLevel: z.number().int().min(0).max(4).nullable(),
  website: z.string().url().nullable(),
  ticketUrl: z.string().url().nullable(),
  requiresAdvanceBooking: z.boolean(),
  indoor: z.boolean(),
  kidFriendly: z.boolean(),
  /** One-paragraph description per language (Wikipedia extract or Wikidata description) with its source URL. */
  /** Per-language description: Wikipedia lead (with url) or Wikidata description; `translatedFrom` marks a machine translation of that language's text. */
  summary: z
    .record(
      z.string(),
      z.object({
        text: z.string(),
        url: z.string().url().nullable(),
        translatedFrom: z.string().optional(),
        /** The article's lead photo (Wikimedia Commons), 320 px thumbnail URL + the article as credit. */
        image: z.object({ url: z.string().url(), page: z.string().url().nullable() }).nullable().optional(),
      }),
    )
    .optional(),
  dataQuality: z.enum(dataQualities),
  source: z.enum(["seed", "osm", "google", "user"]),
  wikidata: z.string().regex(/^Q\d+$/).nullable(),
});
export type PlaceSeed = z.infer<typeof placeSeedSchema>;

export const citySeedSchema = z.object({
  slug: z.string(),
  countryCode: z.string().length(2),
  names: localizedNamesSchema,
  center: z.object({ lat: z.number(), lng: z.number() }),
  /** [south, west, north, east] */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** The city's Wikipedia lead photo, when fetched (`npm run data:summaries --images`). */
  image: z.object({ url: z.string().url(), page: z.string().url().nullable() }).nullable().optional(),
});
export type CitySeed = z.infer<typeof citySeedSchema>;

export const poisFileSchema = z.object({
  generatedAt: z.string(),
  attribution: z.string(),
  cities: z.array(citySeedSchema),
  places: z.array(placeSeedSchema),
});
export type PoisFile = z.infer<typeof poisFileSchema>;

/** Hand-maintained extras that no free API provides. Each entry names its source. */
export const countryExtrasSchema = z.object({
  code: z.string().length(2),
  plugTypes: z.array(z.string()),
  voltage: z.string(),
  frequency: z.string(),
  emergency: z.object({ general: z.string(), police: z.string(), ambulance: z.string(), fire: z.string() }),
  tapWaterSafe: z.boolean().nullable(),
  // he + en are hand-written; other UI languages fall back to English.
  tippingNote: z.object({ he: z.string(), en: z.string() }).catchall(z.string()).nullable(),
  sources: z.array(z.string().url()),
});
export type CountryExtras = z.infer<typeof countryExtrasSchema>;
export const countryExtrasFileSchema = z.array(countryExtrasSchema);

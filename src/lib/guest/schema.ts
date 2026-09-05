import { z } from "zod";
import { tripPreferencesSchema } from "@/lib/planner/types";
import { citySeedSchema, placeSeedSchema } from "@/lib/data/schemas";
import { itinerarySchema } from "@/lib/planner/itinerary";
import { affiliateLinkSchema } from "@/lib/providers/affiliate";
import { eveningSchema, venueSchema } from "@/lib/nearby/schema";
import { seasonalItemSchema } from "@/lib/data/seasonal";

/**
 * Shapes shared by the browser (localStorage) and the server (share links, sync).
 * Plain Zod, no "use client": importable from API routes and server components.
 */
export const planExtrasSchema = z.object({
  weather: z.record(
    z.string(),
    z.object({
      date: z.string(),
      precipProbability: z.number(),
      precipMm: z.number().nullable(),
      tempMax: z.number().nullable(),
      tempMin: z.number().nullable(),
      code: z.number().nullable(),
      kind: z.enum(["forecast", "normals"]),
    }),
  ),
  weatherSource: z.string().nullable(),
  holidays: z.array(z.object({ date: z.string(), name: z.string(), localName: z.string(), countryCode: z.string() })),
  rates: z.object({ base: z.string(), date: z.string(), rates: z.record(z.string(), z.number()), source: z.string() }).nullable(),
  links: z.object({
    hotels: z.array(z.object({ stayId: z.string(), links: z.array(affiliateLinkSchema) })),
    tickets: z.record(z.string(), z.array(affiliateLinkSchema)),
    flights: z.array(affiliateLinkSchema),
    /** Added in milestone 9; older saved plans have none. */
    cars: z.array(affiliateLinkSchema).optional(),
    /** Link format version; the trip view refreshes links whose version is older (see LINKS_VERSION). */
    version: z.number().int().optional(),
  }),
  providers: z.record(z.string(), z.string()),
  notes: z.array(z.string()),
  /** Milestone 11: restaurants around each meal (by meal activity id) and one evening per day index. Older plans have none until refreshed. */
  dining: z.record(z.string(), z.array(venueSchema)).optional(),
  evenings: z.record(z.string(), eveningSchema).optional(),
  /** Milestone 12: seasonal highlights overlapping the dates, and 65+ discounts when someone in the party is 65+. */
  seasonal: z.array(seasonalItemSchema.extend({ firstDate: z.string() })).optional(),
  seniors: z
    .object({
      countries: z.array(z.object({ countryCode: z.string(), note: z.record(z.string(), z.string()), url: z.string() })),
      places: z.record(z.string(), z.object({ note: z.record(z.string(), z.string()), url: z.string() })),
    })
    .nullable()
    .optional(),
});
export type PlanExtras = z.infer<typeof planExtrasSchema>;

export const guestPlanSchema = z.object({
  itinerary: itinerarySchema,
  places: z.record(z.string(), placeSeedSchema),
  cities: z.array(citySeedSchema),
  unused: z.array(z.string()),
  extras: planExtrasSchema.optional(),
  /** UI languages for which place descriptions were already requested (so a place without any source is not re-asked on every open). */
  summariesFor: z.array(z.string()).optional(),
});
export type GuestPlan = z.infer<typeof guestPlanSchema>;

/** Trip journal: free text and a 1-5 rating per day, plus a closing note. Written during / after the trip. */
export const journalSchema = z.object({
  days: z.record(z.string(), z.object({ text: z.string().max(5000), rating: z.number().int().min(1).max(5).nullable() })),
  summary: z.string().max(5000),
});
export type Journal = z.infer<typeof journalSchema>;

export const guestTripSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  preferences: tripPreferencesSchema,
  plan: guestPlanSchema.optional(),
  journal: journalSchema.optional(),
  /** Ticked packing items */
  packing: z.record(z.string(), z.boolean()).optional(),
  /** Ticked checklist items */
  checklist: z.record(z.string(), z.boolean()).optional(),
  /** Public share link, once created */
  share: z.object({ token: z.string(), canEdit: z.boolean(), createdAt: z.string() }).optional(),
  /** Map tiles pre-cached for offline use */
  offline: z.object({ tiles: z.number(), at: z.string() }).optional(),
  /** Set by the sync layer for trips shared with this account (absent = my own trip). */
  membership: z.object({ role: z.enum(["owner", "editor", "viewer"]), ownerName: z.string().nullable() }).optional(),
});
export type GuestTrip = z.infer<typeof guestTripSchema>;

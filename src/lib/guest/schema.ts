import { z } from "zod";
import { tripPreferencesSchema } from "@/lib/planner/types";
import { citySeedSchema, placeSeedSchema } from "@/lib/data/schemas";
import { itinerarySchema } from "@/lib/planner/itinerary";
import { affiliateLinkSchema } from "@/lib/providers/affiliate";

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
  }),
  providers: z.record(z.string(), z.string()),
  notes: z.array(z.string()),
});
export type PlanExtras = z.infer<typeof planExtrasSchema>;

export const guestPlanSchema = z.object({
  itinerary: itinerarySchema,
  places: z.record(z.string(), placeSeedSchema),
  cities: z.array(citySeedSchema),
  unused: z.array(z.string()),
  extras: planExtrasSchema.optional(),
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
});
export type GuestTrip = z.infer<typeof guestTripSchema>;

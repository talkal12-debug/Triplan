import { z } from "zod";
import { tripPreferencesSchema } from "@/lib/planner/types";
import { guestPlanSchema } from "@/lib/guest/schema";

/**
 * A ready-made plan in the gallery: preferences + the generated plan snapshot.
 * Built once by scripts/build-templates.ts and committed to data/templates/,
 * so the gallery works offline and without a database. Titles live in the
 * message files (gallery.templates.<id>) so they are translated like everything else.
 */
export const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  preferences: tripPreferencesSchema,
  plan: guestPlanSchema,
  generatedAt: z.string(),
});
export type TripTemplate = z.infer<typeof templateSchema>;

/** Lightweight card data for the gallery page. */
export type TemplateSummary = {
  id: string;
  countries: string[];
  days: number;
  places: number;
  walkKm: number;
  effort: TripTemplate["preferences"]["effort"];
  budget: TripTemplate["preferences"]["budget"]["level"];
  adults: number;
  children: number;
  generatedAt: string;
};

export function summarize(t: TripTemplate): TemplateSummary {
  return {
    id: t.id,
    countries: t.preferences.destinations.map((d) => d.countryCode),
    days: t.preferences.dates.days,
    places: t.plan.itinerary.stats.places,
    walkKm: t.plan.itinerary.stats.totalWalkKm,
    effort: t.preferences.effort,
    budget: t.preferences.budget.level,
    adults: t.preferences.party.adults,
    children: t.preferences.party.childrenAges.length + t.preferences.party.infants,
    generatedAt: t.generatedAt,
  };
}

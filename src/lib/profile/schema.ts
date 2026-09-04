import { z } from "zod";
import { tripPreferencesSchema } from "@/lib/planner/types";

/**
 * Traveler profile: the wizard answers that rarely change between trips.
 * Stored per account (TravelerProfile.defaults) and cached in localStorage so
 * the wizard can be prefilled offline. Plain Zod, importable from both sides.
 */
export const profileDefaultsSchema = tripPreferencesSchema
  .pick({ party: true, effort: true, accessibility: true, transport: true, carOptions: true, interests: true, budget: true, hotel: true })
  .partial();
export type ProfileDefaults = z.infer<typeof profileDefaultsSchema>;

export const profileSchema = z.object({
  name: z.string().max(80).nullable(),
  defaults: profileDefaultsSchema,
});
export type Profile = z.infer<typeof profileSchema>;

/** A place the traveller has already been to; excluded from future plans. */
export const visitedPlaceSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  countryCode: z.string().length(2),
  city: z.string().nullable(),
  when: z.string().nullable(),
});
export type VisitedPlace = z.infer<typeof visitedPlaceSchema>;

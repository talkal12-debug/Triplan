import { defaultTripPreferences, type TripPreferences } from "@/lib/planner/types";
import type { WizardStep } from "./steps";

/** Countries with a curated seed; mirrors src/lib/data/countries.ts (server-only). */
export const demoCountryCodes = ["PT", "IT", "JP"] as const;

/** Message keys under `wizard.*` describing why a step cannot be completed. */
export type WizardError =
  | "destination.required"
  | "destination.cityRequired"
  | "dates.pastDate"
  | "dates.invalidDate"
  | "party.seniorsTooMany"
  | "party.noAdult"
  | "transport.atLeastOne"
  | "interests.atLeastOne";

export function stepErrors(step: WizardStep, prefs: TripPreferences, today = new Date()): WizardError[] {
  switch (step) {
    case "destination": {
      if (prefs.destinations.length === 0) return ["destination.required"];
      // Countries without a curated seed need at least one picked city (we cannot guess).
      const missingCity = prefs.destinations.some((d) => !demoCountryCodes.includes(d.countryCode.toUpperCase() as (typeof demoCountryCodes)[number]) && d.cities.length === 0);
      return missingCity ? ["destination.cityRequired"] : [];
    }
    case "dates": {
      const start = new Date(`${prefs.dates.start}T00:00:00`);
      if (Number.isNaN(start.getTime())) return ["dates.invalidDate"];
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return start < todayMidnight ? ["dates.pastDate"] : [];
    }
    case "party":
      return prefs.travelers.length > 0 && !prefs.travelers.some((t) => t.kind === "adult" || t.kind === "senior")
        ? ["party.noAdult"]
        : prefs.party.seniors > prefs.party.adults
          ? ["party.seniorsTooMany"]
          : [];
    case "transport":
      return Object.values(prefs.transport).every((w) => w === 0) ? ["transport.atLeastOne"] : [];
    case "interests":
      return prefs.interests.length === 0 ? ["interests.atLeastOne"] : [];
    default:
      return [];
  }
}

/** Errors across all steps, for the summary. */
export function allErrors(prefs: TripPreferences, today = new Date()): Partial<Record<WizardStep, WizardError[]>> {
  const steps: WizardStep[] = ["destination", "dates", "party", "transport", "interests"];
  const out: Partial<Record<WizardStep, WizardError[]>> = {};
  for (const s of steps) {
    const errs = stepErrors(s, prefs, today);
    if (errs.length) out[s] = errs;
  }
  return out;
}

/** Reset just this step's fields to their defaults ("skip"). Destination has no default. */
export function applyStepDefault(step: WizardStep, prefs: TripPreferences): TripPreferences {
  const d = defaultTripPreferences();
  switch (step) {
    case "wishlist":
      return { ...prefs, mustVisit: d.mustVisit };
    case "dates":
      return { ...prefs, dates: d.dates };
    case "party":
      return { ...prefs, party: d.party };
    case "visit":
      return { ...prefs, visitNumber: d.visitNumber, alreadySeenNotes: d.alreadySeenNotes };
    case "pace":
      return { ...prefs, effort: d.effort, accessibility: d.accessibility };
    case "transport":
      return { ...prefs, transport: d.transport, carOptions: d.carOptions };
    case "interests":
      return { ...prefs, interests: d.interests, evening: d.evening };
    case "budget":
      return { ...prefs, budget: { ...d.budget, currency: prefs.budget.currency } };
    case "hotel":
      return { ...prefs, hotel: d.hotel };
    default:
      return prefs;
  }
}

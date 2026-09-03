import { defaultTripPreferences, type TripPreferences } from "@/lib/planner/types";
import type { WizardStep } from "./steps";

/** Message keys under `wizard.*` describing why a step cannot be completed. */
export type WizardError =
  | "destination.required"
  | "dates.pastDate"
  | "dates.invalidDate"
  | "party.seniorsTooMany"
  | "transport.atLeastOne"
  | "interests.atLeastOne";

export function stepErrors(step: WizardStep, prefs: TripPreferences, today = new Date()): WizardError[] {
  switch (step) {
    case "destination":
      return prefs.destinations.length === 0 ? ["destination.required"] : [];
    case "dates": {
      const start = new Date(`${prefs.dates.start}T00:00:00`);
      if (Number.isNaN(start.getTime())) return ["dates.invalidDate"];
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      return start < todayMidnight ? ["dates.pastDate"] : [];
    }
    case "party":
      return prefs.party.seniors > prefs.party.adults ? ["party.seniorsTooMany"] : [];
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
      return { ...prefs, interests: d.interests };
    case "budget":
      return { ...prefs, budget: { ...d.budget, currency: prefs.budget.currency } };
    case "hotel":
      return { ...prefs, hotel: d.hotel };
    default:
      return prefs;
  }
}

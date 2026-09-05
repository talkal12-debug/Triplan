import type { GuestPlan } from "@/lib/guest/schema";
import type { TripPreferences } from "@/lib/planner/types";

/**
 * What the assistant sees: a compact, id-addressable view of the plan.
 * Pure, so it is unit-tested and the prompt stays predictable in size
 * (roughly 60 bytes per activity).
 */
export type CompactActivity = { id: string; kind: string; name: string; start: string; end: string; locked: boolean };
export type CompactDay = { index: number; date: string; city: string; intensity: string; activities: CompactActivity[] };
export type CompactPlan = {
  days: CompactDay[];
  unusedPlaces: { id: string; name: string; category: string }[];
  warnings: string[];
};

function hhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function compactPlan(plan: GuestPlan, placeName: (id: string) => string, maxUnused = 25): CompactPlan {
  return {
    days: plan.itinerary.days.map((d) => ({
      index: d.index,
      date: d.date,
      city: d.citySlug,
      intensity: d.stats.intensity,
      activities: d.activities.map((a) => ({
        id: a.id,
        kind: a.kind,
        name: a.placeId ? placeName(a.placeId) : a.kind,
        start: hhmm(a.startMin),
        end: hhmm(a.endMin),
        locked: a.locked,
      })),
    })),
    unusedPlaces: plan.unused.slice(0, maxUnused).map((id) => ({ id, name: placeName(id), category: plan.places[id]?.category ?? "unknown" })),
    warnings: plan.itinerary.warnings.map((w) => w.code),
  };
}

export function compactPreferences(p: TripPreferences) {
  return {
    days: p.dates.days,
    party: { adults: p.party.adults, childrenAges: p.party.childrenAges, infants: p.party.infants, seniors: p.party.seniors },
    effort: p.effort,
    interests: p.interests,
    transport: p.transport,
    budget: p.budget.level,
    accessibility: p.accessibility,
  };
}

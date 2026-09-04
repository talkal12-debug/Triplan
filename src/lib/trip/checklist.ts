import type { GuestPlan } from "@/lib/guest/trips";
import type { TripPreferences } from "@/lib/planner/types";
import { tripEndDate } from "@/lib/planner/types";

/**
 * Pre-trip checklist with due dates, plus "smart alerts" derived from the plan:
 * advance bookings, holidays, unverified places, trip warnings.
 */
export type ChecklistItem = {
  id: string;
  /** ISO date by which it should be done */
  due: string;
  /** Message params (place names, counts) */
  params?: Record<string, string | number>;
  severity: "info" | "warning";
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildChecklist(prefs: TripPreferences, plan: GuestPlan | undefined, placeName: (id: string) => string): ChecklistItem[] {
  const start = prefs.dates.start;
  const end = tripEndDate(prefs.dates);
  const items: ChecklistItem[] = [
    { id: "passport_validity", due: addDays(start, -60), params: { until: addDays(end, 183) }, severity: "warning" },
    { id: "insurance", due: addDays(start, -14), severity: "warning" },
    { id: "flights", due: addDays(start, -45), severity: "info" },
    { id: "lodging", due: addDays(start, -30), severity: "info" },
  ];
  if (prefs.transport.car > 0) items.push({ id: "car_rental", due: addDays(start, -21), severity: "info" });
  if (prefs.party.infants > 0 || prefs.party.childrenAges.length > 0) items.push({ id: "kids_documents", due: addDays(start, -30), severity: "warning" });

  if (plan) {
    const advance = new Set<string>();
    for (const day of plan.itinerary.days) {
      for (const a of day.activities) {
        const p = a.placeId ? plan.places[a.placeId] : undefined;
        if (p?.requiresAdvanceBooking && !advance.has(p.id)) {
          advance.add(p.id);
          items.push({ id: "book_place", due: addDays(day.date, -21), params: { place: placeName(p.id), date: day.date }, severity: "warning" });
        }
      }
    }
    for (const h of plan.extras?.holidays ?? []) {
      const dayIndex = plan.itinerary.days.findIndex((d) => d.date === h.date);
      if (dayIndex >= 0) items.push({ id: "holiday", due: addDays(h.date, -7), params: { name: h.localName, day: dayIndex + 1 }, severity: "warning" });
    }
    const unverified = plan.itinerary.days.flatMap((d) => d.activities).filter((a) => a.dataQuality === "unverified").length;
    if (unverified > 0) items.push({ id: "verify_places", due: addDays(start, -7), params: { count: unverified }, severity: "info" });
    for (const w of plan.itinerary.warnings) {
      if (w.code === "base_too_far" || w.code === "city_dropped") {
        items.push({ id: `warning_${w.code}`, due: addDays(start, -30), params: w.params as Record<string, string | number>, severity: "info" });
      }
    }
  }
  items.push({ id: "currency", due: addDays(start, -7), severity: "info" }, { id: "esim", due: addDays(start, -3), severity: "info" }, { id: "offline", due: addDays(start, -1), severity: "info" });
  return items.sort((a, b) => a.due.localeCompare(b.due));
}

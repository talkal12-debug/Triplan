import "server-only";
import type { PlaceSeed } from "@/lib/data/schemas";
import type { Itinerary } from "@/lib/planner/itinerary";
import type { PlannerCity } from "@/lib/planner/itinerary";
import type { TripPreferences } from "@/lib/planner/types";
import type { Locale } from "@/lib/i18n/locales";
import { getCountry, countryName } from "@/lib/data/countries";
import { affiliateIdsFromEnv, eveningLinks } from "@/lib/providers/affiliate";
import { nearbyVenues, type NearbyRequest } from "@/lib/providers/nearby";
import { hasLocalVenues, localVenues } from "@/lib/data/venues";
import { nominatimVenues } from "@/lib/providers/nominatim-pois";
import { getEvents } from "@/lib/providers/events/ticketmaster";
import { tryProvider } from "@/lib/providers/http";
import { styleKinds, type EventItem, type Evening, type Venue } from "@/lib/nearby/schema";
import { classificationNamesFor, rankEvents } from "@/lib/nearby/event-types";

export type NearbyPlan = {
  /** Restaurants around each meal, keyed by the meal activity id. */
  dining: Record<string, Venue[]>;
  /** One entry per day index. */
  evenings: Record<string, Evening>;
  eventsProvider: string;
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Where a meal happens: the stop before it, else the stop after it, else the day's base. */
function mealPoint(day: Itinerary["days"][number], index: number, placeById: Map<string, PlaceSeed>, base: { lat: number; lng: number }) {
  for (let i = index - 1; i >= 0; i--) {
    const p = day.activities[i].placeId ? placeById.get(day.activities[i].placeId!) : undefined;
    if (p) return { lat: p.lat, lng: p.lng };
  }
  for (let i = index + 1; i < day.activities.length; i++) {
    const p = day.activities[i].placeId ? placeById.get(day.activities[i].placeId!) : undefined;
    if (p) return { lat: p.lat, lng: p.lng };
  }
  return base;
}

/**
 * Restaurants near every meal, dinner + evening venues near every stay, and events
 * on each date (when an events provider is configured). One Overpass request for
 * the whole plan; failures leave the sections empty and add a note.
 */
export async function buildNearby(prefs: TripPreferences, itinerary: Itinerary, ctx: { places: PlaceSeed[]; cities: PlannerCity[] }, locale: Locale, notes: string[]): Promise<NearbyPlan> {
  const placeById = new Map(ctx.places.map((p) => [p.id, p]));
  const stayById = new Map(itinerary.stays.map((s) => [s.id, s]));
  const style = prefs.evening;
  const requests: NearbyRequest[] = [];
  for (const day of itinerary.days) {
    const stay = stayById.get(day.stayId);
    const base = stay?.center ?? ctx.cities[0].center;
    const countryCode = stay?.countryCode ?? ctx.cities[0].countryCode;
    day.activities.forEach((a, i) => {
      if (a.kind !== "meal") return;
      const p = mealPoint(day, i, placeById, base);
      requests.push({ key: a.id, lat: p.lat, lng: p.lng, radiusM: 500, group: "food", countryCode });
    });
  }
  for (const stay of itinerary.stays) {
    requests.push({ key: `dinner:${stay.id}`, lat: stay.center.lat, lng: stay.center.lng, radiusM: 900, group: "food", countryCode: stay.countryCode });
    if (style !== "none") requests.push({ key: `evening:${stay.id}`, lat: stay.center.lat, lng: stay.center.lng, radiusM: 1500, group: "evening", countryCode: stay.countryCode, kinds: styleKinds[style] });
  }
  // Demo destinations ship their venues with the app; everything else asks Overpass (best effort).
  const local = requests.filter((r) => hasLocalVenues(r.countryCode));
  const remote = requests.filter((r) => !hasLocalVenues(r.countryCode));
  const venues: Record<string, Venue[]> = { ...localVenues(local, 6) };
  if (remote.length) {
    const fromOverpass = await tryProvider("overpass-nearby", () => nearbyVenues(remote, 6), null as Record<string, Venue[]> | null, notes);
    // Overpass unreachable: Nominatim, a few paced queries (meals first, then the evenings).
    const ordered = [...remote.filter((r) => r.group === "food"), ...remote.filter((r) => r.group !== "food")];
    Object.assign(venues, fromOverpass ?? (await tryProvider("nominatim-nearby", () => nominatimVenues(ordered, 6, 10), {} as Record<string, Venue[]>, notes)));
    if (!fromOverpass) notes.push("nearby: Nominatim fallback (Overpass unreachable)");
  }
  if (local.length) notes.push("nearby: shipped OpenStreetMap venues (data/venues)");
  const allowFastFood = prefs.budget.level === "budget";
  const food = (list: Venue[] | undefined) => (list ?? []).filter((v) => allowFastFood || v.kind !== "fast_food");

  const dining: Record<string, Venue[]> = {};
  for (const r of requests) if (r.group === "food" && !r.key.startsWith("dinner:")) dining[r.key] = food(venues[r.key]);

  // Events: one query per stay for its date range, then split by day. With preferred kinds, a second
  // query restricted to them runs alongside, so a busy city cannot crowd them out; they come first.
  const eventsProvider = getEvents();
  const eventsByStay = new Map<string, EventItem[]>();
  const kinds = prefs.eventTypes;
  if (eventsProvider.name !== "none" && style !== "none") {
    for (const stay of itinerary.stays) {
      const query = { lat: stay.center.lat, lng: stay.center.lng, radiusKm: 15, start: addDays(prefs.dates.start, stay.fromDay), end: addDays(prefs.dates.start, stay.toDay), locale };
      const list = await tryProvider(
        `events:${stay.id}`,
        async () => {
          const [wanted, all] = await Promise.all([kinds.length ? eventsProvider.search({ ...query, classificationNames: classificationNamesFor(kinds) }) : [], eventsProvider.search(query)]);
          const seen = new Set<string>();
          return [...wanted, ...all].filter((e) => !seen.has(e.id) && seen.add(e.id));
        },
        [] as EventItem[],
        notes,
      );
      eventsByStay.set(stay.id, list);
    }
  }

  const ids = affiliateIdsFromEnv();
  const evenings: Record<string, Evening> = {};
  for (const day of itinerary.days) {
    const stay = stayById.get(day.stayId);
    if (!stay) continue;
    const city = ctx.cities.find((c) => c.slug === stay.citySlug);
    const country = getCountry(stay.countryCode);
    const wanted = styleKinds[style];
    const stayVenues = (venues[`evening:${stay.id}`] ?? []).filter((v) => wanted.includes(v.kind));
    // Style order first (e.g. theatres before cinemas), then OSM completeness order as returned.
    stayVenues.sort((a, b) => wanted.indexOf(a.kind) - wanted.indexOf(b.kind));
    evenings[String(day.index)] = {
      style,
      center: stay.center,
      dinner: food(venues[`dinner:${stay.id}`]).slice(0, 5),
      venues: stayVenues.slice(0, 6),
      events: rankEvents((eventsByStay.get(stay.id) ?? []).filter((e) => e.start.slice(0, 10) === day.date), kinds).slice(0, 8),
      eventsSource: eventsProvider.name === "none" ? null : eventsProvider.name,
      links: style === "none" ? [] : eveningLinks({ city: city?.names.en ?? stay.citySlug, countryCode: stay.countryCode, countryName: country ? countryName(country, "en") : undefined, date: day.date, style }, ids),
    };
  }
  return { dining, evenings, eventsProvider: eventsProvider.name };
}

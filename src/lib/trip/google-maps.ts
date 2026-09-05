import type { GuestPlan } from "@/lib/guest/schema";

export type GoogleTravelMode = "walking" | "driving" | "bicycling" | "transit";

/** Google Maps Directions URLs accept the origin, the destination and at most this many waypoints. */
export const MAX_WAYPOINTS = 9;

const fmt = (p: { lat: number; lng: number }) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/**
 * A Google Maps directions link for a whole day: hotel -> every stop in order.
 * Opens the Google Maps app on phones (turn-by-turn on real streets), the site elsewhere.
 * Pure and client-safe; unit-tested.
 */
export function dayDirectionsUrl(plan: GuestPlan, dayIndex: number): { url: string; stops: number; truncated: boolean; mode: GoogleTravelMode } | null {
  const day = plan.itinerary.days[dayIndex];
  if (!day) return null;
  const stay = plan.itinerary.stays.find((s) => s.id === day.stayId);
  const stops = day.activities
    .filter((a) => a.kind === "visit" && a.placeId && plan.places[a.placeId])
    .map((a) => ({ point: plan.places[a.placeId!], mode: a.transitFromPrev?.mode }));
  if (stops.length === 0) return null;

  // Travel mode: the most common leg mode of the day (public transport wins ties with walking).
  const counts: Record<string, number> = {};
  for (const s of stops) if (s.mode) counts[s.mode] = (counts[s.mode] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mode: GoogleTravelMode = top === "car" ? "driving" : top === "bike" ? "bicycling" : top === "transit" ? "transit" : "walking";

  const points = [...(stay ? [stay.center] : []), ...stops.map((s) => s.point)];
  const origin = points[0];
  let middle = points.slice(1, -1);
  const destination = points[points.length - 1];
  const truncated = middle.length > MAX_WAYPOINTS;
  if (truncated) middle = middle.slice(0, MAX_WAYPOINTS);

  const params = new URLSearchParams({ api: "1", origin: fmt(origin), destination: fmt(destination), travelmode: mode });
  if (middle.length) params.set("waypoints", middle.map(fmt).join("|"));
  return { url: `https://www.google.com/maps/dir/?${params.toString()}`, stops: stops.length, truncated, mode };
}

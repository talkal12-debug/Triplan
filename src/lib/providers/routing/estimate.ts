import { estimateMinutes, haversineKm, type LatLng } from "@/lib/planner/geo";
import type { TravelMode } from "@/lib/planner/itinerary";
import type { RoutingProvider, TravelMatrix } from "../types";

/** Straight-line × detour factor. Same formula the planner uses; always available. */
export const estimateRouting: RoutingProvider = {
  name: "estimate",
  async matrix(points: LatLng[], mode: TravelMode): Promise<TravelMatrix> {
    const minutes = points.map((a) => points.map((b) => estimateMinutes(haversineKm(a, b), mode)));
    const meters = points.map((a) => points.map((b) => Math.round(haversineKm(a, b) * 1.3 * 1000)));
    return { minutes, meters, estimated: true };
  },
  async route() {
    return null;
  },
};

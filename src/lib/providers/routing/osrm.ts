import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { RouteGeometry, RoutingProvider, TravelMatrix } from "../types";
import type { LatLng } from "@/lib/planner/geo";
import type { TravelMode } from "@/lib/planner/itinerary";
import { estimateRouting } from "./estimate";

const tableSchema = z.object({
  code: z.string(),
  durations: z.array(z.array(z.number().nullable())).optional(),
  distances: z.array(z.array(z.number().nullable())).optional(),
});

/**
 * OSRM table service. Default: the FOSSGIS demo servers (foot / bike / car profiles,
 * fair use, no key). Set OSRM_BASE_URL to your own instance ("{profile}" is replaced).
 * Public transport has no OSRM profile: those legs stay estimated.
 */
const DEFAULT_BASE = "https://routing.openstreetmap.de/routed-{profile}";
const profiles: Partial<Record<TravelMode, string>> = { walk: "foot", bike: "bike", car: "car" };
const MAX_POINTS = 25;

export function osrmRouting(baseUrl = process.env.OSRM_BASE_URL || DEFAULT_BASE): RoutingProvider {
  return {
    name: "osrm",
    async matrix(points: LatLng[], mode: TravelMode): Promise<TravelMatrix> {
      const profile = profiles[mode];
      if (!profile || points.length < 2 || points.length > MAX_POINTS) {
        return estimateRouting.matrix(points, mode);
      }
      const coords = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
      const base = baseUrl.replace("{profile}", profile);
      const url = `${base}/table/v1/driving/${coords}?annotations=duration,distance`;
      const data = await fetchJson(url, { provider: `osrm-${profile}`, schema: tableSchema, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000, timeoutMs: 15_000 });
      if (data.code !== "Ok" || !data.durations || !data.distances) {
        return estimateRouting.matrix(points, mode);
      }
      const overhead = mode === "car" ? 8 : mode === "bike" ? 3 : 0; // parking / unlocking
      return {
        minutes: data.durations.map((row) => row.map((s) => (s === null ? null : Math.max(1, Math.round(s / 60)) + overhead))),
        meters: data.distances.map((row) => row.map((m) => (m === null ? null : Math.round(m)))),
        estimated: false,
      };
    },
    /** Street geometry for the map: one route through all the day's stops in order. */
    async route(points: LatLng[], mode: TravelMode): Promise<RouteGeometry | null> {
      const profile = profiles[mode];
      if (!profile || points.length < 2 || points.length > MAX_POINTS) return null;
      const coords = points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
      const base = baseUrl.replace("{profile}", profile);
      const url = `${base}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
      try {
        const data = await fetchJson(url, { provider: `osrm-${profile}-route`, schema: routeSchema, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000, timeoutMs: 15_000 });
        const r = data.routes?.[0];
        if (data.code !== "Ok" || !r) return null;
        return { coordinates: r.geometry.coordinates, meters: Math.round(r.distance), minutes: Math.max(1, Math.round(r.duration / 60)) };
      } catch {
        return null;
      }
    },
  };
}

const routeSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(z.tuple([z.number(), z.number()])) }),
      }),
    )
    .optional(),
});

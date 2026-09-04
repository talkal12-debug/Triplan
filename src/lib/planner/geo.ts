import type { TripPreferences } from "./types";
import type { TravelMode, Transit } from "./itinerary";

export type LatLng = { lat: number; lng: number };

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) return { lat: 0, lng: 0 };
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Straight-line estimates until OSRM arrives (milestone 6).
 * Road distance ≈ 1.3 × straight line. Speeds in km/h, overhead in minutes.
 */
const DETOUR = 1.3;
const modeProfile: Record<TravelMode, { kmh: number; overheadMin: number; maxKm: number }> = {
  walk: { kmh: 4.5, overheadMin: 0, maxKm: 6 },
  bike: { kmh: 14, overheadMin: 5, maxKm: 15 },
  transit: { kmh: 20, overheadMin: 12, maxKm: 60 },
  car: { kmh: 30, overheadMin: 10, maxKm: 400 },
};

export function estimateMinutes(km: number, mode: TravelMode): number {
  const p = modeProfile[mode];
  const roadKm = km * DETOUR;
  // Intercity legs are faster than urban ones: motorways and regional trains.
  let kmh = p.kmh;
  let overhead = p.overheadMin;
  if (mode === "car" && roadKm > 25) kmh = 70;
  if (mode === "transit" && roadKm > 15) {
    kmh = 45;
    overhead = 15;
  }
  return Math.round((roadKm / kmh) * 60 + overhead);
}

/** Walking is preferred up to this distance, depending on effort. */
export function walkThresholdKm(prefs: TripPreferences): number {
  const base = { low: 0.7, medium: 1.4, high: 2.4 }[prefs.effort];
  const slow = prefs.accessibility.length > 0 || prefs.party.seniors > 0 || prefs.party.infants > 0;
  return slow ? base * 0.7 : base;
}

/** Pick the best transport between two points given what the traveller is willing to use. */
export function estimateTravel(a: LatLng, b: LatLng, prefs: TripPreferences): Transit {
  const km = haversineKm(a, b);
  const meters = Math.round(km * DETOUR * 1000);
  const enabled = (["walk", "bike", "car", "transit"] as const).filter((m) => prefs.transport[m] > 0);
  const canWalk = enabled.includes("walk") || enabled.length === 0;

  if (canWalk && km <= walkThresholdKm(prefs)) {
    return { mode: "walk", minutes: estimateMinutes(km, "walk"), meters, estimated: true };
  }

  const candidates = (enabled.length ? enabled : (["walk", "transit"] as const))
    .filter((m) => km <= modeProfile[m].maxKm)
    .map((m) => {
      const minutes = estimateMinutes(km, m);
      // Preference weight (1-3) discounts perceived time so a "prefer" mode wins ties.
      const weight = prefs.transport[m] || 1;
      return { mode: m, minutes, perceived: minutes / (0.7 + weight * 0.15) };
    })
    .sort((x, y) => x.perceived - y.perceived);

  const best = candidates[0] ?? { mode: "car" as const, minutes: estimateMinutes(km, "car") };
  return { mode: best.mode, minutes: best.minutes, meters, estimated: true };
}

/** Distance the traveller actually walks for a transit leg (walking legs count fully, others a fixed access walk). */
export function walkedKm(t: Transit): number {
  if (t.mode === "walk") return t.meters / 1000;
  if (t.mode === "transit") return 0.5;
  return 0.2;
}

/** Nearest-neighbour tour from `start`, improved with 2-opt. Returns visiting order (indexes into points). */
export function tourOrder(start: LatLng, points: LatLng[]): number[] {
  const n = points.length;
  if (n <= 1) return points.map((_, i) => i);
  const remaining = new Set(points.map((_, i) => i));
  const order: number[] = [];
  let current = start;
  while (remaining.size) {
    let best = -1;
    let bestD = Infinity;
    for (const i of remaining) {
      const d = haversineKm(current, points[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    order.push(best);
    remaining.delete(best);
    current = points[best];
  }
  // 2-opt (open path from start)
  const dist = (i: number, j: number) => haversineKm(i < 0 ? start : points[order[i]], points[order[j]]);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const before = dist(i - 1, i) + (j + 1 < n ? dist(j, j + 1) : 0);
        const after = dist(i - 1, j) + (j + 1 < n ? dist(i, j + 1) : 0);
        if (after + 1e-9 < before) {
          order.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return order;
}

/** Order a list of places to visit as a cycle-free route between cities (open TSP by nearest neighbour). */
export function routeCities<T extends { center: LatLng }>(items: T[], startIndex: number): T[] {
  if (items.length <= 1) return [...items];
  const order = tourOrder(items[startIndex].center, items.filter((_, i) => i !== startIndex).map((c) => c.center));
  const rest = items.filter((_, i) => i !== startIndex);
  return [items[startIndex], ...order.map((i) => rest[i])];
}

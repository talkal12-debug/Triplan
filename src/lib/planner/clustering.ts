import { centroid, haversineKm, type LatLng } from "./geo";
import type { ScoredPlace } from "./scoring";
import type { TripPreferences } from "./types";

export type Cluster = {
  id: string;
  citySlug: string;
  center: LatLng;
  radiusKm: number;
  /** Members sorted by score desc. */
  members: ScoredPlace[];
  /** Sum of member scores: how much a day here is "worth". */
  value: number;
  /** Total visit minutes of members. */
  visitMinutes: number;
  indoorShare: number;
};

/** Neighbourhood radius for "walkable together", by effort. */
export function clusterEpsKm(prefs: TripPreferences): number {
  const base = { low: 0.8, medium: 1.2, high: 1.8 }[prefs.effort];
  return prefs.accessibility.length > 0 || prefs.party.infants > 0 ? base * 0.8 : base;
}

/**
 * DBSCAN on coordinates. Noise points become singleton clusters so nothing is lost;
 * the day assignment decides whether a lone place is worth the detour.
 */
export function clusterPlaces(items: ScoredPlace[], citySlug: string, epsKm: number, minPts = 2): Cluster[] {
  const n = items.length;
  const labels = new Array<number>(n).fill(-1); // -1 = unvisited/noise
  let clusterId = 0;

  const neighbours = (i: number) => {
    const out: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j && haversineKm(items[i].place, items[j].place) <= epsKm) out.push(j);
    }
    return out;
  };

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -1) continue;
    const nb = neighbours(i);
    if (nb.length + 1 < minPts) continue; // noise for now
    clusterId += 1;
    labels[i] = clusterId;
    const queue = [...nb];
    while (queue.length) {
      const j = queue.shift()!;
      if (labels[j] === -1 || labels[j] === 0) {
        labels[j] = clusterId;
        const nb2 = neighbours(j);
        if (nb2.length + 1 >= minPts) queue.push(...nb2.filter((k) => labels[k] === -1));
      }
    }
  }
  // Singletons for the noise.
  for (let i = 0; i < n; i++) {
    if (labels[i] === -1) labels[i] = ++clusterId;
  }

  const groups = new Map<number, ScoredPlace[]>();
  labels.forEach((label, i) => {
    groups.set(label, [...(groups.get(label) ?? []), items[i]]);
  });

  return [...groups.entries()]
    .map(([label, members]) => {
      members.sort((a, b) => b.score - a.score || a.place.id.localeCompare(b.place.id));
      const center = centroid(members.map((m) => m.place));
      const radiusKm = Math.max(0, ...members.map((m) => haversineKm(center, m.place)));
      return {
        id: `${citySlug}-c${label}`,
        citySlug,
        center,
        radiusKm,
        members,
        value: members.reduce((s, m) => s + m.score, 0),
        visitMinutes: members.reduce((s, m) => s + m.place.visitMinutes, 0),
        indoorShare: members.filter((m) => m.place.indoor).length / members.length,
      };
    })
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
}

/** Two clusters can share a day when their centres are close. */
export function clustersAdjacent(a: Cluster, b: Cluster, maxKm: number): boolean {
  return haversineKm(a.center, b.center) <= maxKm;
}

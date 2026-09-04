"use client";

import { z } from "zod";
import type { PlaceSeed } from "@/lib/data/schemas";
import { profileSchema, visitedPlaceSchema, type Profile, type VisitedPlace } from "./schema";

/**
 * Browser-side profile cache (`triplan:profile`). Guests keep their "already
 * visited" list here only; members get it mirrored from the account so the
 * wizard can prefill and exclude visited places even offline.
 */
export const PROFILE_KEY = "triplan:profile";

const cacheSchema = z.object({
  profile: profileSchema.nullable(),
  visited: z.array(visitedPlaceSchema),
  updatedAt: z.string(),
});
export type ProfileCache = z.infer<typeof cacheSchema>;

const empty = (): ProfileCache => ({ profile: null, visited: [], updatedAt: new Date(0).toISOString() });

export function readProfileCache(): ProfileCache {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return empty();
    const parsed = cacheSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : empty();
  } catch {
    return empty();
  }
}

function writeProfileCache(cache: ProfileCache) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ ...cache, updatedAt: new Date().toISOString() }));
  } catch {
    // quota / private mode
  }
}

export function visitedIds(): string[] {
  return readProfileCache().visited.map((v) => v.placeId);
}

/** Pull profile + visited list from the account into the cache (members only, best-effort). */
export async function refreshProfileCache(): Promise<ProfileCache | null> {
  try {
    const [p, v] = await Promise.all([fetch("/api/profile", { cache: "no-store" }), fetch("/api/visited", { cache: "no-store" })]);
    if (!p.ok || !v.ok) return null;
    const profile = profileSchema.parse(((await p.json()) as { profile: unknown }).profile);
    const visited = z.array(visitedPlaceSchema).parse(((await v.json()) as { visited: unknown }).visited);
    const cache: ProfileCache = { profile, visited, updatedAt: new Date().toISOString() };
    writeProfileCache(cache);
    return cache;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: Profile, signedIn: boolean): Promise<Profile | null> {
  const cache = readProfileCache();
  writeProfileCache({ ...cache, profile });
  if (!signedIn) return profile;
  try {
    const res = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile }) });
    if (!res.ok) return null;
    return profileSchema.parse(((await res.json()) as { profile: unknown }).profile);
  } catch {
    return null;
  }
}

/** Remember a place as visited: locally at once, in the account when signed in. */
export async function markVisited(place: PlaceSeed, label: string, signedIn: boolean, when: string | null = null): Promise<void> {
  const cache = readProfileCache();
  const entry: VisitedPlace = { placeId: place.id, name: label, countryCode: place.countryCode, city: place.city, when };
  writeProfileCache({ ...cache, visited: [entry, ...cache.visited.filter((v) => v.placeId !== place.id)] });
  if (!signedIn) return;
  try {
    await fetch("/api/visited", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place, when }) });
  } catch {
    // stays local; the next refresh reconciles
  }
}

export async function unmarkVisited(placeId: string, signedIn: boolean): Promise<void> {
  const cache = readProfileCache();
  writeProfileCache({ ...cache, visited: cache.visited.filter((v) => v.placeId !== placeId) });
  if (!signedIn) return;
  try {
    await fetch(`/api/visited?placeId=${encodeURIComponent(placeId)}`, { method: "DELETE" });
  } catch {
    // ignore
  }
}

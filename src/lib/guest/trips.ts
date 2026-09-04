"use client";

import { z } from "zod";
import type { TripPreferences } from "@/lib/planner/types";
import { guestTripSchema, type GuestTrip } from "./schema";

export { guestPlanSchema, guestTripSchema, journalSchema, planExtrasSchema } from "./schema";
export type { GuestPlan, GuestTrip, Journal, PlanExtras } from "./schema";

/**
 * Trips live in localStorage: for guests that is the only copy, for members it
 * is a cache of the account's trips (src/lib/trips/sync.ts keeps both sides in
 * step). Every view reads from here, so the app works offline either way.
 * A trip holds the preferences and, once built, the plan with a snapshot of the
 * places it references (so it renders offline and survives data updates).
 */
export const GUEST_TRIPS_KEY = "triplan:guest-trips";

type Listener = (trips: GuestTrip[], changed: { id: string; deleted?: boolean; remote?: boolean } | null) => void;
const listeners = new Set<Listener>();

/** Subscribe to local changes (and to remote updates merged in by the sync layer). */
export function onGuestTripsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(trips: GuestTrip[], changed: Parameters<Listener>[1]) {
  for (const l of listeners) l(trips, changed);
}

function read(): GuestTrip[] {
  try {
    const raw = localStorage.getItem(GUEST_TRIPS_KEY);
    if (!raw) return [];
    const parsed = z.array(guestTripSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function write(trips: GuestTrip[]) {
  try {
    localStorage.setItem(GUEST_TRIPS_KEY, JSON.stringify(trips));
  } catch {
    // Private mode / quota: the trip stays in memory for this session only.
  }
}

export function listGuestTrips(): GuestTrip[] {
  return read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getGuestTrip(id: string): GuestTrip | undefined {
  return read().find((t) => t.id === id);
}

export function createGuestTrip(preferences: TripPreferences, extra: Partial<Pick<GuestTrip, "plan">> = {}): GuestTrip {
  const now = new Date().toISOString();
  const id = `g_${now.slice(0, 10).replaceAll("-", "")}_${Math.random().toString(36).slice(2, 8)}`;
  const trip: GuestTrip = { id, createdAt: now, updatedAt: now, preferences, ...extra };
  const trips = [trip, ...read()];
  write(trips);
  emit(trips, { id });
  return trip;
}

export type GuestTripPatch = Partial<Pick<GuestTrip, "preferences" | "plan" | "packing" | "checklist" | "share" | "offline" | "journal">>;

export function updateGuestTrip(id: string, patch: GuestTripPatch): GuestTrip | undefined {
  const trips = read();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx < 0) return undefined;
  trips[idx] = { ...trips[idx], ...patch, updatedAt: new Date().toISOString() };
  write(trips);
  emit(trips, { id });
  return trips[idx];
}

export function deleteGuestTrip(id: string) {
  const trips = read().filter((t) => t.id !== id);
  write(trips);
  emit(trips, { id, deleted: true });
}

/**
 * Merge trips that arrived from the account (sync). A remote copy replaces the
 * local one only when it is newer; unknown trips are added. Returns the ids that changed.
 */
export function mergeRemoteTrips(remote: GuestTrip[]): string[] {
  const trips = read();
  const changed: string[] = [];
  for (const r of remote) {
    const idx = trips.findIndex((t) => t.id === r.id);
    if (idx < 0) {
      trips.push(r);
      changed.push(r.id);
    } else if (r.updatedAt > trips[idx].updatedAt) {
      trips[idx] = r;
      changed.push(r.id);
    }
  }
  if (changed.length) {
    write(trips);
    for (const id of changed) emit(trips, { id, remote: true });
  }
  return changed;
}

/** Drop a trip locally without treating it as a user deletion (e.g. removed on another device). */
export function forgetGuestTrip(id: string) {
  const trips = read().filter((t) => t.id !== id);
  write(trips);
  emit(trips, { id, deleted: true, remote: true });
}

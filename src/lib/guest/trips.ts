"use client";

import { z } from "zod";
import type { TripPreferences } from "@/lib/planner/types";
import { guestTripSchema, type GuestTrip } from "./schema";

export { guestPlanSchema, guestTripSchema, planExtrasSchema } from "./schema";
export type { GuestPlan, GuestTrip, PlanExtras } from "./schema";

/**
 * Guest trips live in localStorage until the traveller signs up (milestone 8).
 * A trip holds the preferences and, once built, the plan with a snapshot of the
 * places it references (so it renders offline and survives data updates).
 */
export const GUEST_TRIPS_KEY = "triplan:guest-trips";

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

export function createGuestTrip(preferences: TripPreferences): GuestTrip {
  const now = new Date().toISOString();
  const id = `g_${now.slice(0, 10).replaceAll("-", "")}_${Math.random().toString(36).slice(2, 8)}`;
  const trip: GuestTrip = { id, createdAt: now, updatedAt: now, preferences };
  write([trip, ...read()]);
  return trip;
}

export function updateGuestTrip(id: string, patch: Partial<Pick<GuestTrip, "preferences" | "plan" | "packing" | "checklist" | "share" | "offline">>): GuestTrip | undefined {
  const trips = read();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx < 0) return undefined;
  trips[idx] = { ...trips[idx], ...patch, updatedAt: new Date().toISOString() };
  write(trips);
  return trips[idx];
}

export function deleteGuestTrip(id: string) {
  write(read().filter((t) => t.id !== id));
}

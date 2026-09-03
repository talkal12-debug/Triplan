"use client";

import { z } from "zod";
import { tripPreferencesSchema, type TripPreferences } from "@/lib/planner/types";

/**
 * Guest trips live in localStorage until the traveller signs up (milestone 8).
 * Only the preferences are stored now; the generated itinerary joins in milestone 4.
 */
export const GUEST_TRIPS_KEY = "triplan:guest-trips";

export const guestTripSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  preferences: tripPreferencesSchema,
});
export type GuestTrip = z.infer<typeof guestTripSchema>;

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

export function deleteGuestTrip(id: string) {
  write(read().filter((t) => t.id !== id));
}

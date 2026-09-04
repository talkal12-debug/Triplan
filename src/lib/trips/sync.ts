"use client";

import { z } from "zod";
import { guestTripSchema, type GuestTrip } from "@/lib/guest/schema";
import { forgetGuestTrip, listGuestTrips, mergeRemoteTrips } from "@/lib/guest/trips";

/**
 * Keeps the account's trips and the localStorage copy in step.
 * - migrateAndPull(): after sign-in, upload every local trip (guest -> account),
 *   then download the account's trips and merge the newer ones in.
 * - pushTrip(): after a local edit, upload that trip (debounced by the caller).
 * All calls are best-effort: offline or a failing server never blocks the UI.
 */
const tripsResponse = z.object({ trips: z.array(guestTripSchema) });

export async function pullTrips(): Promise<{ merged: string[]; removed: string[] } | null> {
  try {
    const res = await fetch("/api/trips", { cache: "no-store" });
    if (!res.ok) return null;
    const { trips } = tripsResponse.parse(await res.json());
    const merged = mergeRemoteTrips(trips);
    return { merged, removed: [] };
  } catch {
    return null;
  }
}

export async function pushAllTrips(trips: GuestTrip[]): Promise<Record<string, string> | null> {
  if (trips.length === 0) return {};
  try {
    const res = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trips }) });
    if (!res.ok) return null;
    return ((await res.json()) as { results: Record<string, string> }).results;
  } catch {
    return null;
  }
}

export async function pushTrip(trip: GuestTrip): Promise<string | null> {
  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(trip.id)}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trip }) });
    if (!res.ok) return null;
    return ((await res.json()) as { result: string }).result;
  } catch {
    return null;
  }
}

export async function deleteRemoteTrip(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/trips/${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Sign-in handshake: local trips go up, account trips come down. */
export async function migrateAndPull(): Promise<{ uploaded: number; merged: number } | null> {
  const local = listGuestTrips();
  const results = await pushAllTrips(local);
  if (results === null) return null;
  const uploaded = Object.values(results).filter((r) => r === "created").length;
  // A trip that belongs to someone else stays out of this account's cache.
  for (const [id, r] of Object.entries(results)) if (r === "forbidden") forgetGuestTrip(id);
  const pulled = await pullTrips();
  return { uploaded, merged: pulled?.merged.length ?? 0 };
}

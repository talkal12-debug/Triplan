"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { getGuestTrip, onGuestTripsChange } from "@/lib/guest/trips";
import { deleteRemoteTrip, migrateAndPull, pushTrip } from "@/lib/trips/sync";

const PUSH_DEBOUNCE_MS = 1500;

/**
 * Mounted once in the layout. While a member is signed in:
 * - on session start: guest trips are moved into the account, account trips merged in
 * - every local change is uploaded (debounced), deletions are mirrored
 * Guests: nothing happens, localStorage is the only copy.
 */
export function TripSync() {
  const { status, data } = useSession();
  const userId = data?.user?.id ?? null;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !userId) {
      lastUser.current = null;
      return;
    }
    if (lastUser.current !== userId) {
      lastUser.current = userId;
      void migrateAndPull();
    }
    const timersMap = timers.current;
    const off = onGuestTripsChange((_trips, changed) => {
      if (!changed || changed.remote) return;
      const pending = timersMap.get(changed.id);
      if (pending) clearTimeout(pending);
      if (changed.deleted) {
        void deleteRemoteTrip(changed.id);
        return;
      }
      timersMap.set(
        changed.id,
        setTimeout(() => {
          timersMap.delete(changed.id);
          const trip = getGuestTrip(changed.id);
          if (trip) void pushTrip(trip);
        }, PUSH_DEBOUNCE_MS),
      );
    });
    return () => {
      off();
      for (const t of timersMap.values()) clearTimeout(t);
      timersMap.clear();
    };
  }, [status, userId]);

  return null;
}

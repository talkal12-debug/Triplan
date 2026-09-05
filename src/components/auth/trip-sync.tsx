"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

const PUSH_DEBOUNCE_MS = 1500;

/**
 * Mounted once in the layout. While a member is signed in:
 * - on session start: guest trips are moved into the account, account trips merged in
 * - every local change is uploaded (debounced), deletions are mirrored
 * Guests: nothing happens, localStorage is the only copy.
 *
 * The sync module (Zod schemas included) is imported lazily, so guests and
 * static pages do not pay for it in the layout bundle.
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
    let off: (() => void) | undefined;
    let cancelled = false;
    const timersMap = timers.current;
    void Promise.all([import("@/lib/trips/sync"), import("@/lib/guest/trips")]).then(([sync, trips]) => {
      if (cancelled) return;
      if (lastUser.current !== userId) {
        lastUser.current = userId;
        void sync.migrateAndPull();
      }
      off = trips.onGuestTripsChange((_all, changed) => {
        if (!changed || changed.remote) return;
        const pending = timersMap.get(changed.id);
        if (pending) clearTimeout(pending);
        if (changed.deleted) {
          void sync.deleteRemoteTrip(changed.id);
          return;
        }
        timersMap.set(
          changed.id,
          setTimeout(() => {
            timersMap.delete(changed.id);
            const trip = trips.getGuestTrip(changed.id);
            if (trip) void sync.pushTrip(trip);
          }, PUSH_DEBOUNCE_MS),
        );
      });
    });
    return () => {
      cancelled = true;
      off?.();
      for (const t of timersMap.values()) clearTimeout(t);
      timersMap.clear();
    };
  }, [status, userId]);

  return null;
}

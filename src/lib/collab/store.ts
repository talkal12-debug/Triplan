"use client";

import { create } from "zustand";
import { collabStateSchema, type CollabState } from "./schema";

/**
 * Collaboration state of the trip currently open (members, votes, comments).
 * Filled by CollabPanel / the trip view, read by activity cards for the vote bar.
 * Polled while the trip is open; every action returns the fresh state.
 */
type CollabStore = {
  state: CollabState | null;
  loading: boolean;
  load: (tripId: string) => Promise<CollabState | null>;
  act: (tripId: string, body: Record<string, unknown>) => Promise<CollabState | null>;
  clear: () => void;
};

export const useCollabStore = create<CollabStore>()((set) => ({
  state: null,
  loading: false,
  async load(tripId) {
    set({ loading: true });
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collab`, { cache: "no-store" });
      if (!res.ok) {
        set({ state: null, loading: false });
        return null;
      }
      const state = collabStateSchema.parse(await res.json());
      set({ state, loading: false });
      return state;
    } catch {
      set({ loading: false });
      return null;
    }
  },
  async act(tripId, body) {
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const state = collabStateSchema.parse(await res.json());
      set({ state });
      return state;
    } catch {
      return null;
    }
  },
  clear() {
    set({ state: null });
  },
}));

/** Tally for one activity: up/down counts and my own vote. */
export function tally(state: CollabState | null, activityId: string): { up: number; down: number; mine: number } {
  if (!state) return { up: 0, down: 0, mine: 0 };
  let up = 0;
  let down = 0;
  let mine = 0;
  for (const v of state.votes) {
    if (v.activityId !== activityId) continue;
    if (v.value > 0) up++;
    else down++;
    if (v.userId === state.me) mine = v.value;
  }
  return { up, down, mine };
}

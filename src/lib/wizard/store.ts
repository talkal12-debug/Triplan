"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  defaultTripPreferences,
  tripDraftSchema,
  type TripPreferences,
} from "@/lib/planner/types";
import type { WizardStep } from "./steps";

/**
 * Wizard draft. Persisted to localStorage so a guest never loses work
 * (auto-save on every change). Milestone 8 migrates this into the account.
 */
type WizardState = {
  prefs: TripPreferences;
  /** Furthest step the traveller has reached, for the progress bar / resume. */
  reached: WizardStep;
  /** Steps completed explicitly (Next) or skipped (defaults accepted). */
  done: WizardStep[];
  hydrated: boolean;
  update: (patch: Partial<TripPreferences>) => void;
  set: <K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) => void;
  markDone: (step: WizardStep, reached: WizardStep) => void;
  reset: () => void;
  setHydrated: (v: boolean) => void;
};

export const WIZARD_STORAGE_KEY = "triplan:wizard-draft";

export const useWizardStore = create<WizardState>()(
  persist(
    (set) => ({
      prefs: defaultTripPreferences(),
      reached: "destination",
      done: [],
      hydrated: false,
      update: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      set: (key, value) => set((s) => ({ prefs: { ...s.prefs, [key]: value } })),
      markDone: (step, reached) =>
        set((s) => ({
          done: s.done.includes(step) ? s.done : [...s.done, step],
          reached,
        })),
      reset: () => set({ prefs: defaultTripPreferences(), reached: "destination", done: [] }),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: WIZARD_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrate in an effect (WizardShell) so server and first client render match.
      skipHydration: true,
      partialize: (s) => ({ prefs: s.prefs, reached: s.reached, done: s.done }),
      // Drop drafts that no longer match the schema instead of crashing on them.
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<WizardState, "prefs" | "reached" | "done">> | undefined;
        const parsed = p?.prefs ? tripDraftSchema.safeParse(p.prefs) : null;
        return {
          ...current,
          prefs: parsed?.success ? parsed.data : current.prefs,
          reached: parsed?.success && p?.reached ? p.reached : current.reached,
          done: parsed?.success && p?.done ? p.done : current.done,
        };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const unitSystems = ["metric", "imperial"] as const;
export type UnitSystem = (typeof unitSystems)[number];

export function isUnitSystem(value: string): value is UnitSystem {
  return (unitSystems as readonly string[]).includes(value);
}

type UnitsState = {
  units: UnitSystem;
  hydrated: boolean;
  setUnits: (units: UnitSystem) => void;
  setHydrated: (v: boolean) => void;
};

export const UNITS_STORAGE_KEY = "triplan:units";

/**
 * Distance units preference (km vs miles). Independent of the UI language:
 * a traveller reading English in Israel still wants kilometres.
 * Rehydrated in an effect (useUnits) so server and first client render match.
 */
export const useUnitsStore = create<UnitsState>()(
  persist(
    (set) => ({
      units: "metric",
      hydrated: false,
      setUnits: (units) => set({ units }),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: UNITS_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ units: s.units }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<UnitsState, "units">> | undefined;
        return { ...current, units: p?.units && isUnitSystem(p.units) ? p.units : current.units };
      },
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
    },
  ),
);

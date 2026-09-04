"use client";

import { useEffect } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toDisplayDistance } from "./distance";
import { useUnitsStore, type UnitSystem } from "./store";

/** Current unit system plus a setter; rehydrates the persisted choice on mount. */
export function useUnits(): { units: UnitSystem; setUnits: (u: UnitSystem) => void } {
  const units = useUnitsStore((s) => s.units);
  const setUnits = useUnitsStore((s) => s.setUnits);
  const hydrated = useUnitsStore((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) void useUnitsStore.persist.rehydrate();
  }, [hydrated]);
  return { units, setUnits };
}

/** Returns a formatter: kilometres in → localized "12 km" / "7.5 mi" out. */
export function useDistance(): (km: number) => string {
  const { units } = useUnits();
  const t = useTranslations("units");
  const format = useFormatter();
  return (km: number) => {
    const { value, unit } = toDisplayDistance(km, units);
    return t(unit, { value: format.number(value, { maximumFractionDigits: 1 }) });
  };
}

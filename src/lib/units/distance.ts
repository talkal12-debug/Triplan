import type { UnitSystem } from "./store";

export const KM_PER_MILE = 1.609344;

/**
 * Converts a distance in kilometres to the display unit, rounded to one
 * decimal (whole numbers above 10) so the plan never shows "3.21 mi".
 * Pure, so it can be unit-tested and reused by the print view.
 */
export function toDisplayDistance(km: number, units: UnitSystem): { value: number; unit: "km" | "mi" } {
  const raw = units === "imperial" ? km / KM_PER_MILE : km;
  const value = raw >= 10 ? Math.round(raw) : Math.round(raw * 10) / 10;
  return { value, unit: units === "imperial" ? "mi" : "km" };
}

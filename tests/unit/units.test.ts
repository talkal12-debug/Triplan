import { describe, expect, it } from "vitest";
import { toDisplayDistance, KM_PER_MILE } from "@/lib/units/distance";

describe("toDisplayDistance", () => {
  it("keeps kilometres as-is in metric", () => {
    expect(toDisplayDistance(7.25, "metric")).toEqual({ value: 7.3, unit: "km" });
    expect(toDisplayDistance(12.4, "metric")).toEqual({ value: 12, unit: "km" });
  });

  it("converts to miles in imperial", () => {
    expect(toDisplayDistance(KM_PER_MILE * 5, "imperial")).toEqual({ value: 5, unit: "mi" });
    expect(toDisplayDistance(8, "imperial")).toEqual({ value: 5, unit: "mi" });
    expect(toDisplayDistance(1, "imperial")).toEqual({ value: 0.6, unit: "mi" });
  });

  it("rounds to whole numbers above 10 and one decimal below", () => {
    expect(toDisplayDistance(10.04, "metric").value).toBe(10);
    expect(toDisplayDistance(9.96, "metric").value).toBe(10);
    expect(toDisplayDistance(0.04, "metric").value).toBe(0);
  });
});

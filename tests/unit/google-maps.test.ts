import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dayDirectionsUrl, MAX_WAYPOINTS } from "@/lib/trip/google-maps";
import { templateSchema } from "@/lib/templates/schema";

const template = templateSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "templates", "rome-first-time-4.json"), "utf8")));

describe("dayDirectionsUrl", () => {
  it("builds a directions link from the hotel through every stop", () => {
    const r = dayDirectionsUrl(template.plan, 1);
    expect(r).not.toBeNull();
    const url = new URL(r!.url);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("origin")).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
    expect(url.searchParams.get("destination")).toMatch(/^-?\d+\.\d+,-?\d+\.\d+$/);
    expect(["walking", "driving", "bicycling", "transit"]).toContain(url.searchParams.get("travelmode"));
    const waypoints = url.searchParams.get("waypoints")?.split("|") ?? [];
    // hotel + stops = origin + waypoints + destination
    expect(waypoints.length).toBe(Math.min(r!.stops + 1 - 2, MAX_WAYPOINTS));
    expect(r!.truncated).toBe(r!.stops + 1 - 2 > MAX_WAYPOINTS);
  });

  it("returns null for a day without stops", () => {
    const plan = { ...template.plan, itinerary: { ...template.plan.itinerary, days: template.plan.itinerary.days.map((d) => ({ ...d, activities: [] })) } };
    expect(dayDirectionsUrl(plan, 0)).toBeNull();
    expect(dayDirectionsUrl(template.plan, 99)).toBeNull();
  });
});

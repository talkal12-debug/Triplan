import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compactPlan, compactPreferences } from "@/lib/chat/compact";
import { templateSchema } from "@/lib/templates/schema";

const template = templateSchema.parse(JSON.parse(readFileSync(join(process.cwd(), "data", "templates", "rome-first-time-4.json"), "utf8")));

describe("compactPlan", () => {
  it("keeps every activity id and formats times", () => {
    const c = compactPlan(template.plan, (id) => `name:${id}`);
    expect(c.days.length).toBe(template.plan.itinerary.days.length);
    const ids = new Set(template.plan.itinerary.days.flatMap((d) => d.activities.map((a) => a.id)));
    for (const day of c.days) {
      for (const a of day.activities) {
        expect(ids.has(a.id)).toBe(true);
        expect(a.start).toMatch(/^\d{2}:\d{2}$/);
        expect(a.end).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  it("names visits and caps the unused list", () => {
    const c = compactPlan(template.plan, (id) => `name:${id}`, 3);
    const visit = c.days.flatMap((d) => d.activities).find((a) => a.kind === "visit");
    expect(visit?.name.startsWith("name:")).toBe(true);
    expect(c.unusedPlaces.length).toBeLessThanOrEqual(3);
    for (const u of c.unusedPlaces) expect(template.plan.unused).toContain(u.id);
  });

  it("stays small: well under 100 bytes per activity", () => {
    const c = compactPlan(template.plan, (id) => id);
    const activities = c.days.reduce((n, d) => n + d.activities.length, 0);
    expect(JSON.stringify(c.days).length / activities).toBeLessThan(160);
  });

  it("summarises preferences without personal free text", () => {
    const p = compactPreferences(template.preferences);
    expect(p).not.toHaveProperty("alreadySeenNotes");
    expect(p.days).toBe(4);
    expect(p.party.adults).toBe(2);
  });
});

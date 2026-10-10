import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** The world catalogue in Hebrew: names written at dev time (data/world-he) are applied on load. */
describe("world catalogue in Hebrew", () => {
  it("gives every place a Hebrew name", async () => {
    const { getWorldPlaces, worldCountryCodes } = await import("@/lib/data/world");
    let total = 0;
    let missing = 0;
    for (const cc of worldCountryCodes()) {
      for (const p of getWorldPlaces(cc)) {
        total++;
        if (!p.names.he) missing++;
      }
    }
    expect(total).toBeGreaterThan(20_000);
    expect(missing).toBe(0);
  });

  it("keeps OSM's own Hebrew names and adds the written ones (Strahov Monastery, Prague)", async () => {
    const { getWorldPlaces } = await import("@/lib/data/world");
    const strahov = getWorldPlaces("CZ", "prague").find((p) => p.names.en === "Strahov Monastery");
    expect(strahov?.names.he).toMatch(/^מנזר סטר[הח]וב$/);
  });
});

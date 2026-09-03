import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import opening_hours from "opening_hours";
import {
  countriesFileSchema,
  countryExtrasFileSchema,
  poisFileSchema,
  type PoisFile,
} from "@/lib/data/schemas";

const dataDir = join(process.cwd(), "data");
const read = (file: string) => JSON.parse(readFileSync(join(dataDir, file), "utf8"));

describe("data/countries.json", () => {
  const countries = countriesFileSchema.parse(read("countries.json"));

  it("covers the world", () => {
    expect(countries.length).toBeGreaterThanOrEqual(240);
  });

  it("has unique codes and a Hebrew name almost everywhere", () => {
    const codes = new Set(countries.map((c) => c.code));
    expect(codes.size).toBe(countries.length);
    const withoutHebrew = countries.filter((c) => !c.names.he);
    expect(withoutHebrew.length).toBeLessThanOrEqual(3);
  });

  it("knows the demo destinations well", () => {
    const pt = countries.find((c) => c.code === "PT");
    const jp = countries.find((c) => c.code === "JP");
    expect(pt?.names.he).toBe("פורטוגל");
    expect(pt?.currencies[0]?.code).toBe("EUR");
    expect(pt?.drivingSide).toBe("right");
    expect(jp?.drivingSide).toBe("left");
    expect(jp?.callingCode).toBe("+81");
  });
});

describe("data/country-extras.json", () => {
  it("validates and only references known countries", () => {
    const extras = countryExtrasFileSchema.parse(read("country-extras.json"));
    const codes = new Set(countriesFileSchema.parse(read("countries.json")).map((c) => c.code));
    for (const e of extras) {
      expect(codes.has(e.code)).toBe(true);
      expect(e.sources.length).toBeGreaterThan(0);
    }
  });
});

describe("data/pois/*.json", () => {
  const files = readdirSync(join(dataDir, "pois")).filter((f) => f.endsWith(".json"));
  const parsed = new Map<string, PoisFile>(files.map((f) => [f, poisFileSchema.parse(read(join("pois", f)))]));

  it("has the three demo destinations", () => {
    expect(files.sort()).toEqual(["it.json", "jp.json", "pt.json"]);
  });

  it.each(files)("%s: ids are unique and match the file's country", (file) => {
    const { places } = parsed.get(file)!;
    const ids = new Set(places.map((p) => p.id));
    expect(ids.size).toBe(places.length);
    const code = file.replace(".json", "").toUpperCase();
    for (const p of places) {
      expect(p.countryCode).toBe(code);
      expect(p.id.startsWith(`${code.toLowerCase()}-${p.city}-`)).toBe(true);
    }
  });

  it.each(files)("%s: every place sits inside its city's bounding box", (file) => {
    const { cities, places } = parsed.get(file)!;
    const boxes = new Map(cities.map((c) => [c.slug, c.bbox]));
    for (const p of places) {
      const box = boxes.get(p.city);
      expect(box, `unknown city ${p.city}`).toBeDefined();
      const [s, w, n, e] = box!;
      expect(p.lat, p.id).toBeGreaterThanOrEqual(s);
      expect(p.lat, p.id).toBeLessThanOrEqual(n);
      expect(p.lng, p.id).toBeGreaterThanOrEqual(w);
      expect(p.lng, p.id).toBeLessThanOrEqual(e);
    }
  });

  it.each(files)("%s: has enough places and most are verified against OSM", (file) => {
    const { places } = parsed.get(file)!;
    expect(places.length).toBeGreaterThanOrEqual(40);
    const matched = places.filter((p) => p.externalId !== null).length;
    expect(matched / places.length, "share matched to an OSM object").toBeGreaterThanOrEqual(0.8);
  });

  it.each(files)("%s: every opening_hours string is parseable", (file) => {
    const { places } = parsed.get(file)!;
    const countryCode = file.replace(".json", "");
    const bad: string[] = [];
    for (const p of places) {
      if (!p.openingHours) continue;
      try {
        // "PH" (public holidays) needs to know the country; same object the planner will pass.
        const oh = new opening_hours(p.openingHours, {
          lat: p.lat,
          lon: p.lng,
          address: { country_code: countryCode, state: "" },
        });
        oh.getState(new Date("2026-06-15T11:00:00"));
      } catch (err) {
        bad.push(`${p.id}: "${p.openingHours}" -> ${(err as Error).message}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it.each(files)("%s: names are bilingual and Hebrew is really Hebrew", (file) => {
    const { places } = parsed.get(file)!;
    for (const p of places) {
      expect(p.names.he, p.id).toMatch(/[֐-׿]/);
      expect(p.names.en.length, p.id).toBeGreaterThan(1);
      expect(p.nameLocal.length, p.id).toBeGreaterThan(1);
    }
  });
});

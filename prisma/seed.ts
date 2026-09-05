/**
 * Seeds the database from the committed data files:
 *   data/countries.json   -> Country (all ~250)
 *   data/pois/*.json      -> Place  (demo destinations)
 *
 * Idempotent: every row is upserted by its stable id.
 * Usage: npm run db:seed
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { countriesFileSchema, poisFileSchema } from "../src/lib/data/schemas";

const prisma = new PrismaClient();
const dataDir = join(process.cwd(), "data");

async function seedCountries(demoCodes: Set<string>) {
  const countries = countriesFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "countries.json"), "utf8")));
  for (const c of countries) {
    const row = {
      code3: c.code3,
      names: JSON.stringify(c.names),
      flag: c.flag,
      currencies: JSON.stringify(c.currencies),
      languages: JSON.stringify(c.languages),
      drivingSide: c.drivingSide,
      callingCode: c.callingCode,
      timezones: JSON.stringify(c.timezones),
      capital: c.capital,
      lat: c.lat,
      lng: c.lng,
      region: c.region,
      subregion: c.subregion,
      demo: demoCodes.has(c.code),
    };
    await prisma.country.upsert({ where: { code: c.code }, create: { code: c.code, ...row }, update: row });
  }
  return countries.length;
}

async function seedPlaces(): Promise<{ files: string[]; count: number }> {
  const poisDir = join(dataDir, "pois");
  const files = readdirSync(poisDir).filter((f) => f.endsWith(".json"));
  let count = 0;
  for (const file of files) {
    const parsed = poisFileSchema.parse(JSON.parse(readFileSync(join(poisDir, file), "utf8")));
    for (const p of parsed.places) {
      const row = {
        externalId: p.externalId,
        countryCode: p.countryCode,
        city: p.city,
        nameLocal: p.nameLocal,
        names: JSON.stringify(p.names),
        category: p.category,
        tags: JSON.stringify(p.tags),
        lat: p.lat,
        lng: p.lng,
        elevationM: p.elevationM,
        openingHours: p.openingHours,
        closedDates: JSON.stringify(p.closedDates),
        visitMinutes: p.visitMinutes,
        iconicity: p.iconicity,
        minAge: p.minAge,
        wheelchair: p.wheelchair,
        strollerOk: p.strollerOk,
        priceLevel: p.priceLevel,
        website: p.website,
        ticketUrl: p.ticketUrl,
        requiresAdvanceBooking: p.requiresAdvanceBooking,
        dataQuality: p.dataQuality,
        source: p.source,
        wikidata: p.wikidata,
        summary: p.summary ? JSON.stringify(p.summary) : null,
      };
      await prisma.place.upsert({ where: { id: p.id }, create: { id: p.id, ...row }, update: row });
      count += 1;
    }
  }
  return { files, count };
}

async function main() {
  const poisDir = join(dataDir, "pois");
  const demoCodes = new Set(
    readdirSync(poisDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", "").toUpperCase()),
  );
  const countries = await seedCountries(demoCodes);
  console.log(`countries: ${countries} (demo: ${[...demoCodes].join(", ")})`);
  const { files, count } = await seedPlaces();
  console.log(`places: ${count} from ${files.join(", ")}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

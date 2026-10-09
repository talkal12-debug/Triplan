/**
 * Fills missing city names (Hebrew and the other UI languages) in data/world/*.json
 * from Wikipedia interlanguage links. Usage: npx tsx scripts/world/fill-names.mts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { poisFileSchema } from "../../src/lib/data/schemas.ts";
import { fillCityNames } from "./names.ts";

const dir = join(process.cwd(), "data", "world");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const data = poisFileSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
  const added = await fillCityNames(data.cities);
  if (added) writeFileSync(join(dir, f), JSON.stringify(data) + "\n");
  const noHe = data.cities.filter((c) => !c.names.he).map((c) => c.slug);
  console.log(`${f}: ${added} names added${noHe.length ? `, still no Hebrew: ${noHe.join(", ")}` : ""}`);
}

/**
 * Downloads every country flag from flagcdn.com (public domain PNGs) into
 * public/flags/h24 and public/flags/h48 so the app serves them itself:
 * no third-party requests, works offline, one less DNS lookup on first paint.
 *
 * Usage: npm run data:flags   (needs the network; run once, commit the files)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const countries = JSON.parse(readFileSync(join(process.cwd(), "data", "countries.json"), "utf8"));
const codes = countries.map((c) => c.code.toLowerCase());
const sizes = [24, 48];

let downloaded = 0;
for (const h of sizes) {
  const dir = join(process.cwd(), "public", "flags", `h${h}`);
  mkdirSync(dir, { recursive: true });
  for (const code of codes) {
    const file = join(dir, `${code}.png`);
    if (existsSync(file)) continue;
    const res = await fetch(`https://flagcdn.com/h${h}/${code}.png`);
    if (!res.ok) {
      console.warn(`missing ${code} h${h}: ${res.status}`);
      continue;
    }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    downloaded++;
  }
}
console.log(`${codes.length} countries, ${downloaded} files downloaded`);

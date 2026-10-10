/**
 * Hebrew for the world catalogue, step 2: merge translated work files into data/world-he/{cc}.json
 * ({ names: {id: he}, summaries: {id: he}, wrongSummaries: [id] }). A summary answered "-" was not about
 * the place (the architect of a bridge, the radio station of a mast): its id goes to wrongSummaries and
 * the place loses that description in every language. A translated file has the same numbered lines as its
 * work file, each "N<TAB>Hebrew". The runtime loader (src/lib/data/world.ts) applies them, so a
 * rebuild of data/world never loses them.
 * Usage: npx tsx scripts/world/he-apply.mts <work-dir>   (reads <file>.he for every work file)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [work] = process.argv.slice(2);
const index: Record<string, string[]> = JSON.parse(readFileSync(join(work, "index.json"), "utf8"));
const heDir = join(process.cwd(), "data", "world-he");
mkdirSync(heDir, { recursive: true });
const files = new Map<string, { names: Record<string, string>; summaries: Record<string, string>; wrongSummaries?: string[] }>();
const load = (cc: string) => {
  if (!files.has(cc)) {
    const f = join(heDir, `${cc}.json`);
    files.set(cc, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { names: {}, summaries: {} });
  }
  return files.get(cc)!;
};
const hebrew = /[\u0590-\u05FF]/;
let added = 0;
let skipped = 0;
for (const [file, ids] of Object.entries(index)) {
  const done = join(work, `${file}.he`);
  if (!existsSync(done)) continue;
  const kind = file.startsWith("names") ? "names" : "summaries";
  for (const line of readFileSync(done, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(\d+)\t(.+)$/);
    const id = m && ids[Number(m[1]) - 1];
    const text = m?.[2].trim();
    if (id && kind === "summaries" && text === "-") {
      const data = load(id.slice(0, 2));
      data.wrongSummaries = [...new Set([...(data.wrongSummaries ?? []), id])];
      added++;
      continue;
    }
    if (!id || !text || !hebrew.test(text)) {
      if (line.trim()) skipped++;
      continue;
    }
    load(id.slice(0, 2))[kind][id] = text;
    added++;
  }
}
for (const [cc, data] of files) writeFileSync(join(heDir, `${cc}.json`), JSON.stringify(data, null, 0) + "\n");
console.log(`${added} translations applied, ${skipped} lines skipped`);

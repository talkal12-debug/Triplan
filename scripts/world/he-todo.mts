/**
 * Hebrew for the world catalogue, step 1: list what is missing. Writes numbered work files
 * (one line per item, tab-separated) to <out>/names-NN.tsv and <out>/summaries-NN.tsv, plus
 * <out>/index.json mapping each file's line numbers back to place ids. Translations are
 * written by Claude at dev time (like the 75 demo places) and applied with he-apply.mts.
 * Usage: npx tsx scripts/world/he-todo.mts <out-dir> [names-per-file=800] [summaries-per-file=200]
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [out, namesPer = "800", sumPer = "200"] = process.argv.slice(2);
if (!out) throw new Error("usage: he-todo.mts <out-dir>");
mkdirSync(out, { recursive: true });
const dir = join(process.cwd(), "data", "world");
const heDir = join(process.cwd(), "data", "world-he");
const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

type Item = { id: string; line: string };
const names: Item[] = [];
const summaries: Item[] = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(dir, f), "utf8"));
  let done: { names?: Record<string, string>; summaries?: Record<string, string> } = {};
  try {
    done = JSON.parse(readFileSync(join(heDir, f), "utf8"));
  } catch {}
  const cityName = new Map<string, string>(data.cities.map((c: { slug: string; names: { en: string } }) => [c.slug, c.names.en]));
  const byCity = new Map<string, any[]>();
  for (const p of data.places) byCity.set(p.city, [...(byCity.get(p.city) ?? []), p]);
  for (const [city, places] of byCity) {
    const where = `${cityName.get(city) ?? city}, ${f.slice(0, 2).toUpperCase()}`;
    places.sort((a, b) => b.iconicity - a.iconicity);
    places.forEach((p, rank) => {
      if (!p.names.he && !done.names?.[p.id]) {
        const local = p.names.local && p.names.local !== p.names.en ? p.names.local : "";
        names.push({ id: p.id, line: [clean(p.names.en || p.names.local), clean(local), p.category, where].join("\t") });
      }
      const en = p.summary?.en?.text;
      if (rank < 25 && en && !p.summary?.he && !done.summaries?.[p.id]) {
        summaries.push({ id: p.id, line: [clean(p.names.he || done.names?.[p.id] || p.names.en || p.names.local), clean(en)].join("\t") });
      }
    });
  }
}
const index: Record<string, string[]> = {};
const write = (kind: string, items: Item[], per: number) => {
  for (let i = 0, n = 1; i < items.length; i += per, n++) {
    const chunk = items.slice(i, i + per);
    const file = `${kind}-${String(n).padStart(2, "0")}.tsv`;
    writeFileSync(join(out, file), chunk.map((it, k) => `${k + 1}\t${it.line}`).join("\n") + "\n");
    index[file] = chunk.map((it) => it.id);
  }
};
write("names", names, Number(namesPer));
write("summaries", summaries, Number(sumPer));
writeFileSync(join(out, "index.json"), JSON.stringify(index));
console.log(`${names.length} names, ${summaries.length} summaries, ${Object.keys(index).length} files in ${out}`);

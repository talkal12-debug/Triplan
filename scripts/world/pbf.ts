/**
 * OpenStreetMap from files instead of a server: Geofabrik publishes every country
 * as one .osm.pbf (daily, free). The build downloads a country once, scans it for
 * attractions (the same tag net as the Overpass queries) and keeps those few
 * thousand elements in a small index; a city is then just a bounding-box lookup.
 * No rate limits, no 504s, no cost. Files live outside the repo (~/triplan-osm).
 *
 * Ways and relations have no coordinates of their own: the scan runs in passes,
 * first collecting the matching ways/relations and the node ids they need, then
 * the coordinates, then the centre of each. Relations use their member ways.
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createOSMStream } from "osm-pbf-parser-node";
import { matchesAttractionFilter, type OverpassElement } from "../../src/lib/providers/pois/osm-core";

export const OSM_DIR = process.env.TRIPLAN_OSM_DIR || join(homedir(), "triplan-osm");
const MAX_AGE_DAYS = 30;

/** Geofabrik path per country. A few countries share one file; a few are regions of a bigger one. */
export const GEOFABRIK: Record<string, string> = {
  FR: "europe/france", ES: "europe/spain", GB: "europe/great-britain", DE: "europe/germany", NL: "europe/netherlands", BE: "europe/belgium",
  AT: "europe/austria", CH: "europe/switzerland", IE: "europe/ireland-and-northern-ireland", LU: "europe/luxembourg", MC: "europe/monaco",
  IT: "europe/italy", PT: "europe/portugal", DK: "europe/denmark", SE: "europe/sweden", NO: "europe/norway", FI: "europe/finland", IS: "europe/iceland",
  EE: "europe/estonia", LV: "europe/latvia", LT: "europe/lithuania", CZ: "europe/czech-republic", HU: "europe/hungary", PL: "europe/poland",
  SK: "europe/slovakia", SI: "europe/slovenia", HR: "europe/croatia", BA: "europe/bosnia-herzegovina", ME: "europe/montenegro", RS: "europe/serbia",
  RO: "europe/romania", BG: "europe/bulgaria", GR: "europe/greece", CY: "europe/cyprus", MT: "europe/malta", TR: "europe/turkey", GE: "europe/georgia",
  AM: "asia/armenia", IL: "asia/israel-and-palestine", JO: "asia/jordan", AE: "asia/gcc-states", QA: "asia/gcc-states", OM: "asia/gcc-states",
  EG: "africa/egypt", MA: "africa/morocco", TN: "africa/tunisia", ZA: "africa/south-africa", KE: "africa/kenya", TZ: "africa/tanzania", ET: "africa/ethiopia",
  MU: "africa/mauritius", SC: "africa/seychelles", TH: "asia/thailand", VN: "asia/vietnam", KH: "asia/cambodia", LA: "asia/laos",
  MY: "asia/malaysia-singapore-brunei", SG: "asia/malaysia-singapore-brunei", ID: "asia/indonesia", PH: "asia/philippines", KR: "asia/south-korea",
  CN: "asia/china", HK: "asia/china", MO: "asia/china", TW: "asia/taiwan", IN: "asia/india", LK: "asia/sri-lanka", NP: "asia/nepal", MV: "asia/maldives",
  UZ: "asia/uzbekistan", KZ: "asia/kazakhstan", JP: "asia/japan", AU: "australia-oceania/australia", NZ: "australia-oceania/new-zealand", FJ: "australia-oceania/fiji",
  US: "north-america/us", CA: "north-america/canada", MX: "north-america/mexico", CU: "central-america/cuba", DO: "central-america/haiti-and-domrep",
  JM: "central-america/jamaica", CR: "central-america/costa-rica", PA: "central-america/panama", GT: "central-america/guatemala", BS: "central-america/bahamas",
  PR: "north-america/us/puerto-rico", BR: "south-america/brazil", AR: "south-america/argentina", CL: "south-america/chile", PE: "south-america/peru",
  CO: "south-america/colombia", EC: "south-america/ecuador", BO: "south-america/bolivia", UY: "south-america/uruguay",
};

/**
 * Countries too big to scan in one go (the US file is ~11 GB, and the node-id sets of one
 * pass outgrow a JavaScript Set): their cities use the state's file instead. Keyed "CC:slug".
 */
const US = (state: string) => `north-america/us/${state}`;
export const CITY_REGION: Record<string, string> = {
  "US:new-york": US("new-york"), "US:los-angeles": US("california"), "US:san-francisco": US("california"), "US:san-diego": US("california"),
  "US:palm-springs": US("california"), "US:las-vegas": US("nevada"), "US:miami": US("florida"), "US:orlando": US("florida"), "US:key-west": US("florida"),
  "US:chicago": US("illinois"), "US:washington": US("district-of-columbia"), "US:boston": US("massachusetts"), "US:new-orleans": US("louisiana"),
  "US:seattle": US("washington"), "US:nashville": US("tennessee"), "US:austin": US("texas"), "US:honolulu": US("hawaii"),
  "US:philadelphia": US("pennsylvania"), "US:denver": US("colorado"), "US:savannah": US("georgia"), "US:charleston": US("south-carolina"),
  "US:portland": US("oregon"), "US:santa-fe": US("new-mexico"),
};

/** The Geofabrik file that covers a city. */
export function regionFor(cc: string, slug: string): string | undefined {
  return CITY_REGION[`${cc}:${slug}`] ?? (cc === "US" ? undefined : GEOFABRIK[cc]);
}

const fileKey = (path: string) => path.replace(/\//g, "_");
const fresh = (file: string) => existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_DAYS * 86400_000;

/** The region's PBF on disk, downloaded when missing or older than a month. */
export async function ensurePbf(path: string, log: (s: string) => void = console.log): Promise<string> {
  mkdirSync(OSM_DIR, { recursive: true });
  const file = join(OSM_DIR, `${fileKey(path)}.osm.pbf`);
  if (existsSync(file) && Date.now() - statSync(file).mtimeMs < MAX_AGE_DAYS * 86400_000 && statSync(file).size > 1_000_000) return file;
  const url = `https://download.geofabrik.de/${path}-latest.osm.pbf`;
  log(`  downloading ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": "Triplan-world-build/0.1 (talkal12@gmail.com)" } });
  if (!res.ok || !res.body) throw new Error(`download failed: HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  let done = 0;
  let lastPct = -1;
  const progress = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      done += chunk.byteLength;
      const pct = total ? Math.floor((done / total) * 10) * 10 : -1;
      if (pct !== lastPct && pct >= 0) {
        lastPct = pct;
        log(`  ${pct}% of ${(total / 1e6).toFixed(0)} MB`);
      }
      controller.enqueue(chunk);
    },
  });
  const tmp = `${file}.part`;
  await pipeline(Readable.fromWeb(res.body.pipeThrough(progress) as import("node:stream/web").ReadableStream), createWriteStream(tmp));
  const { renameSync } = await import("node:fs");
  renameSync(tmp, file);
  return file;
}

type Index = { builtAt: string; source: string; elements: OverpassElement[] };

/** What the parser yields (it ships no types). */
type OsmItem =
  | { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> }
  | { type: "way"; id: number; refs: number[]; tags?: Record<string, string> }
  | { type: "relation"; id: number; members: { type: string; ref: number; role?: string }[]; tags?: Record<string, string> }
  | { type?: undefined };
const stream = (file: string, withTags: boolean) => createOSMStream(file, { withTags, withInfo: false }) as AsyncGenerator<OsmItem>;

/**
 * All attraction candidates of a Geofabrik region as Overpass-shaped elements, from a cached
 * index (under a month old) or a fresh scan of the PBF. The PBF is deleted after the scan unless
 * TRIPLAN_KEEP_PBF is set: the index is all the build needs, and the files add up to tens of GB.
 */
export async function regionIndex(path: string, log: (s: string) => void = console.log): Promise<OverpassElement[]> {
  const indexFile = join(OSM_DIR, `${fileKey(path)}.attractions.json`);
  const pbfFile = join(OSM_DIR, `${fileKey(path)}.osm.pbf`);
  if (fresh(indexFile) && (!existsSync(pbfFile) || statSync(indexFile).mtimeMs >= statSync(pbfFile).mtimeMs)) {
    return (JSON.parse(readFileSync(indexFile, "utf8")) as Index).elements;
  }
  const pbf = await ensurePbf(path, log);
  log(`  scanning ${pbf} (${(statSync(pbf).size / 1e6).toFixed(0)} MB)`);
  const started = Date.now();
  const elements: OverpassElement[] = [];
  const ways = new Map<number, { tags: Record<string, string>; refs: number[] }>();
  const relations = new Map<number, { tags: Record<string, string>; wayRefs: number[]; nodeRefs: number[] }>();
  const neededWays = new Set<number>();
  const neededNodes = new Set<number>();

  // Pass 1: matching nodes are done at once; matching ways and relations remember what they need.
  for await (const item of stream(pbf, true)) {
    if (item.type === "node") {
      if (item.tags && matchesAttractionFilter(item.tags)) elements.push({ type: "node", id: item.id, lat: item.lat, lon: item.lon, tags: item.tags });
    } else if (item.type === "way") {
      if (item.tags && matchesAttractionFilter(item.tags)) {
        ways.set(item.id, { tags: item.tags, refs: item.refs });
        for (const r of item.refs) neededNodes.add(r);
      }
    } else if (item.type === "relation") {
      if (item.tags && matchesAttractionFilter(item.tags)) {
        const wayRefs = item.members.filter((m) => m.type === "way").map((m) => m.ref);
        const nodeRefs = item.members.filter((m) => m.type === "node").map((m) => m.ref);
        relations.set(item.id, { tags: item.tags, wayRefs, nodeRefs });
        wayRefs.forEach((w) => neededWays.add(w));
        nodeRefs.forEach((n) => neededNodes.add(n));
      }
    }
  }
  log(`  pass 1: ${elements.length} nodes, ${ways.size} ways, ${relations.size} relations (${Math.round((Date.now() - started) / 1000)}s)`);

  // Pass 2: member ways of relations (their node ids), then every needed node's coordinates.
  const memberWays = new Map<number, number[]>();
  if (neededWays.size) {
    for await (const item of stream(pbf, false)) {
      if (item.type === "way" && neededWays.has(item.id)) {
        memberWays.set(item.id, item.refs);
        for (const r of item.refs) neededNodes.add(r);
      }
    }
  }
  const coords = new Map<number, [number, number]>();
  for await (const item of stream(pbf, false)) {
    if (item.type === "node" && neededNodes.has(item.id)) coords.set(item.id, [item.lat, item.lon]);
    else if (item.type === "way") break; // nodes come first in a PBF
  }
  log(`  pass 2: ${coords.size} coordinates (${Math.round((Date.now() - started) / 1000)}s)`);

  const centre = (ids: number[]): { lat: number; lon: number } | null => {
    let lat = 0;
    let lon = 0;
    let n = 0;
    for (const id of ids) {
      const c = coords.get(id);
      if (c) {
        lat += c[0];
        lon += c[1];
        n++;
      }
    }
    return n ? { lat: lat / n, lon: lon / n } : null;
  };
  for (const [id, w] of ways) {
    const c = centre(w.refs);
    if (c) elements.push({ type: "way", id, center: c, tags: w.tags });
  }
  for (const [id, r] of relations) {
    const c = centre([...r.nodeRefs, ...r.wayRefs.flatMap((w) => memberWays.get(w) ?? [])]);
    if (c) elements.push({ type: "relation", id, center: c, tags: r.tags });
  }
  writeFileSync(indexFile, JSON.stringify({ builtAt: new Date().toISOString(), source: pbf, elements } satisfies Index));
  log(`  index: ${elements.length} attraction candidates in ${Math.round((Date.now() - started) / 1000)}s`);
  if (!process.env.TRIPLAN_KEEP_PBF) unlinkSync(pbf);
  return elements;
}

/** Elements inside a bounding box [south, west, north, east]. */
export function elementsInBox(index: OverpassElement[], bbox: [number, number, number, number]): OverpassElement[] {
  const [s, w, n, e] = bbox;
  return index.filter((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    return lat !== undefined && lon !== undefined && lat >= s && lat <= n && lon >= w && lon <= e;
  });
}

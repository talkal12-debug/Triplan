/**
 * Builds data/countries.json from two free, key-less sources:
 *  - mledoze/countries (ODbL): the open dataset REST Countries was built on.
 *    Names, native names, translations, flags, currencies, languages, calling codes,
 *    capitals, coordinates, regions. (REST Countries itself now requires an API key.)
 *  - Wikidata SPARQL: Hebrew labels, driving side, time zones.
 *
 * Usage: npm run data:countries
 * The output is committed so the app never needs the network for this.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { countriesFileSchema } from "../src/lib/data/schemas";

const UA = "Triplan-data-script/0.1 (talkal12@gmail.com)";
const SOURCE = "https://raw.githubusercontent.com/mledoze/countries/master/countries.json";

const sourceCountrySchema = z.object({
  cca2: z.string().length(2),
  cca3: z.string().length(3),
  name: z.object({
    common: z.string(),
    official: z.string(),
    native: z.record(z.string(), z.object({ common: z.string(), official: z.string() })).optional(),
  }),
  flag: z.string(),
  currencies: z.record(z.string(), z.object({ name: z.string().optional(), symbol: z.string().optional() })).optional(),
  languages: z.record(z.string(), z.string()).optional(),
  idd: z.object({ root: z.string().optional(), suffixes: z.array(z.string()).optional() }).optional(),
  latlng: z.tuple([z.number(), z.number()]).optional(),
  region: z.string(),
  subregion: z.string().optional(),
  capital: z.array(z.string()).optional(),
  translations: z.record(z.string(), z.object({ common: z.string(), official: z.string() })).optional(),
});

// dataset translation keys -> Triplan locale codes
const translationMap: Record<string, string> = {
  ara: "ar",
  rus: "ru",
  spa: "es",
  fra: "fr",
  deu: "de",
  ita: "it",
  por: "pt",
  zho: "zh-CN",
  jpn: "ja",
};

async function fetchSource() {
  const res = await fetch(SOURCE, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`countries dataset ${res.status}`);
  return z.array(sourceCountrySchema).parse(await res.json());
}

type WikidataFacts = { he?: string; drivingSide?: "left" | "right"; timezones: Set<string> };

async function fetchWikidata(): Promise<Map<string, WikidataFacts>> {
  const query = `
    SELECT ?code ?he ?driving ?tz WHERE {
      ?item wdt:P297 ?code .
      FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
      OPTIONAL { ?item rdfs:label ?he FILTER(LANG(?he) = "he") }
      OPTIONAL { ?item wdt:P1622 ?d . ?d rdfs:label ?driving FILTER(LANG(?driving) = "en") }
      OPTIONAL { ?item wdt:P421 ?t . ?t rdfs:label ?tz FILTER(LANG(?tz) = "en") }
    }`;
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const binding = z.object({ value: z.string() });
  const json = z
    .object({
      results: z.object({
        bindings: z.array(
          z.object({ code: binding, he: binding.optional(), driving: binding.optional(), tz: binding.optional() }),
        ),
      }),
    })
    .parse(await res.json());

  const map = new Map<string, WikidataFacts>();
  for (const b of json.results.bindings) {
    const code = b.code.value.toUpperCase();
    const facts = map.get(code) ?? { timezones: new Set<string>() };
    if (b.he && !facts.he) facts.he = b.he.value;
    if (b.driving && !facts.drivingSide) {
      facts.drivingSide = /left/i.test(b.driving.value) ? "left" : "right";
    }
    if (b.tz && /^UTC/.test(b.tz.value)) facts.timezones.add(b.tz.value);
    map.set(code, facts);
  }
  return map;
}

/** Regional-indicator emoji from an ISO alpha-2 code, e.g. "PT" -> 🇵🇹 */
function flagFromCode(code: string): string {
  return [...code.toUpperCase()].map((ch) => String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)).join("");
}

function callingCode(idd?: { root?: string; suffixes?: string[] }): string {
  if (!idd?.root) return "";
  const suffixes = idd.suffixes ?? [];
  // +1 is shared by many countries with different suffixes; keep only the root then.
  return suffixes.length === 1 ? `${idd.root}${suffixes[0]}` : idd.root;
}

/**
 * The dataset lists native names alphabetically by language code, which picks
 * Arabic for Israel or German for Belgium. Prefer the most widely used language there.
 */
const preferredNativeLanguage: Record<string, string> = {
  IL: "heb",
  BE: "nld",
  CH: "deu",
  IN: "hin",
  ZA: "eng",
  CA: "eng",
  LU: "ltz",
  PK: "urd",
  PH: "fil",
  MA: "ara",
  DZ: "ara",
  TN: "ara",
  SG: "eng",
  LK: "sin",
  KE: "swa",
  FI: "fin",
  IE: "eng",
  NZ: "eng",
};

function nativeName(code: string, native?: Record<string, { common: string }>): string | undefined {
  if (!native) return undefined;
  const preferred = preferredNativeLanguage[code];
  if (preferred && native[preferred]) return native[preferred].common;
  return Object.values(native)[0]?.common;
}

async function main() {
  const [source, wikidata] = await Promise.all([fetchSource(), fetchWikidata()]);

  const countries = source
    .map((c) => {
      const facts = wikidata.get(c.cca2);
      const native = nativeName(c.cca2, c.name.native);
      const names: Record<string, string> = { en: c.name.common, local: native ?? c.name.common };
      if (facts?.he) names.he = facts.he;
      for (const [key, value] of Object.entries(c.translations ?? {})) {
        const locale = translationMap[key];
        if (locale) names[locale] = value.common;
      }
      return {
        code: c.cca2,
        code3: c.cca3,
        names,
        flag: c.flag || flagFromCode(c.cca2),
        currencies: Object.entries(c.currencies ?? {}).map(([code, v]) => ({
          code,
          name: v.name ?? code,
          symbol: v.symbol ?? "",
        })),
        languages: Object.values(c.languages ?? {}),
        drivingSide: facts?.drivingSide ?? "right",
        callingCode: callingCode(c.idd),
        timezones: [...(facts?.timezones ?? [])].sort(),
        capital: c.capital?.[0] ?? null,
        lat: c.latlng?.[0] ?? 0,
        lng: c.latlng?.[1] ?? 0,
        region: c.region,
        subregion: c.subregion ?? null,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const validated = countriesFileSchema.parse(countries);
  const missingHe = validated.filter((c) => !c.names.he).map((c) => c.code);
  const missingDriving = validated.filter((c) => !wikidata.get(c.code)?.drivingSide).map((c) => c.code);

  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(join(process.cwd(), "data", "countries.json"), JSON.stringify(validated, null, 2) + "\n");
  console.log(`countries.json: ${validated.length} countries, ${validated.length - missingHe.length} with Hebrew names`);
  if (missingHe.length) console.log(`no Hebrew label (falls back to English): ${missingHe.join(", ")}`);
  if (missingDriving.length) console.log(`driving side unknown, defaulted to right: ${missingDriving.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

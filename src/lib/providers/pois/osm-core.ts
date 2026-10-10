import { z } from "zod";
import opening_hours from "opening_hours";
import { placeSeedSchema, type CitySeed, type PlaceCategory, type PlaceSeed, type PlaceTag } from "@/lib/data/schemas";

/**
 * The pure part of the OpenStreetMap POI provider: tag classification, the
 * place record, notability from Wikidata, ranking. No network and no
 * "server-only", so the offline world build (scripts/build-world.ts) and the
 * runtime provider share one definition of what a place is.
 */

/** Bump when classification / ranking changes so cached cities are refetched. */
export const OSM_PROVIDER_VERSION = 4;

export const overpassSchema = z.object({
  elements: z.array(
    z.object({
      type: z.string(),
      id: z.number(),
      lat: z.number().optional(),
      lon: z.number().optional(),
      center: z.object({ lat: z.number(), lon: z.number() }).optional(),
      tags: z.record(z.string(), z.string()).optional(),
    }),
  ),
});
export type OverpassElement = z.infer<typeof overpassSchema>["elements"][number];

export const wikidataSchema = z.object({
  entities: z.record(
    z.string(),
    z.object({
      sitelinks: z.record(z.string(), z.unknown()).optional(),
      labels: z.record(z.string(), z.object({ value: z.string() })).optional(),
    }),
  ),
});
export type WikidataFacts = { sitelinks: number; labels: Record<string, string> };
export const WIKIDATA_LANGUAGES = ["he", "en", "ar", "ru", "es", "fr", "de", "it", "pt", "ja", "zh", "hi"];

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Cap a city's bounding box so Overpass queries stay small (~25 km across). */
export function clampBox(box: [number, number, number, number], center: { lat: number; lng: number }): [number, number, number, number] {
  const maxLat = 0.12;
  const maxLng = 0.16;
  const [s, w, n, e] = box;
  return [Math.max(s, center.lat - maxLat), Math.max(w, center.lng - maxLng), Math.min(n, center.lat + maxLat), Math.min(e, center.lng + maxLng)];
}

/** The two Overpass queries for a box: notable things (with a Wikipedia article) and museums/castles without one. */
export function overpassQueriesFor(bbox: [number, number, number, number], timeoutS = 40): { tier1: string; tier2: string } {
  const [s, w, n, e] = bbox;
  const box = `${s},${w},${n},${e}`;
  const tier1 = `[out:json][timeout:${timeoutS}];
(
  nwr["tourism"~"^(museum|gallery|zoo|aquarium|theme_park|viewpoint|attraction)$"]["name"]["wikipedia"](${box});
  nwr["historic"~"^(castle|palace|monument|ruins|archaeological_site)$"]["name"]["wikipedia"](${box});
  nwr["amenity"="place_of_worship"]["name"]["wikipedia"](${box});
  nwr["leisure"~"^(park|garden)$"]["name"]["wikipedia"](${box});
  nwr["natural"="beach"]["name"](${box});
  nwr["amenity"="marketplace"]["name"](${box});
  nwr["man_made"~"^(tower|bridge)$"]["name"]["wikipedia"](${box});
  nwr["place"="square"]["name"]["wikipedia"](${box});
);
out center tags 1500;`;
  const tier2 = `[out:json][timeout:${timeoutS}];
(
  nwr["tourism"~"^(museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]["name"][!"wikipedia"](${box});
  nwr["historic"~"^(castle|palace)$"]["name"][!"wikipedia"](${box});
);
out center tags 400;`;
  return { tier1, tier2 };
}

/**
 * The same net as the two Overpass queries, for the file-based build: named
 * things with a Wikipedia article in the attraction categories, beaches and
 * markets even without one, and museums, galleries, zoos, aquariums, theme
 * parks, viewpoints, castles and palaces even without one.
 */
export function matchesAttractionFilter(tags: Record<string, string>): boolean {
  if (!tags.name) return false;
  const wiki = Boolean(tags.wikipedia);
  const tourism = tags.tourism;
  if (tourism && ["museum", "gallery", "zoo", "aquarium", "theme_park", "viewpoint"].includes(tourism)) return true;
  if (tourism === "attraction" && wiki) return true;
  const historic = tags.historic;
  if (historic === "castle" || historic === "palace") return true;
  if (historic && ["monument", "ruins", "archaeological_site"].includes(historic) && wiki) return true;
  if (tags.amenity === "place_of_worship" && wiki) return true;
  if ((tags.leisure === "park" || tags.leisure === "garden") && wiki) return true;
  if (tags.natural === "beach") return true;
  if (tags.amenity === "marketplace") return true;
  if ((tags.man_made === "tower" || tags.man_made === "bridge") && wiki) return true;
  if (tags.place === "square" && wiki) return true;
  return false;
}

/** Category + editorial defaults from OSM tags. Returns null for things we do not plan around. */
export function classify(tags: Record<string, string>): { category: PlaceCategory; tags: PlaceTag[]; visitMinutes: number; indoor: boolean; kidFriendly: boolean } | null {
  const t = tags;
  const has = (k: string, v?: string) => (v ? t[k] === v : Boolean(t[k]));
  const wiki = Boolean(t.wikidata || t.wikipedia);
  if (has("tourism", "museum")) return { category: "museum", tags: ["museums", "history"], visitMinutes: 90, indoor: true, kidFriendly: true };
  if (has("tourism", "gallery")) return { category: "gallery", tags: ["art", "museums"], visitMinutes: 75, indoor: true, kidFriendly: false };
  if (has("tourism", "zoo")) return { category: "zoo", tags: ["kids", "nature", "attractions"], visitMinutes: 150, indoor: false, kidFriendly: true };
  if (has("tourism", "aquarium")) return { category: "aquarium", tags: ["kids", "nature", "attractions"], visitMinutes: 90, indoor: true, kidFriendly: true };
  if (has("tourism", "theme_park")) return { category: "theme_park", tags: ["kids", "adventure", "attractions"], visitMinutes: 300, indoor: false, kidFriendly: true };
  if (has("tourism", "viewpoint")) return { category: "viewpoint", tags: ["views", "photography", "free"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("historic", "castle") || has("castle_type")) return { category: "castle", tags: ["history", "views"], visitMinutes: 90, indoor: false, kidFriendly: true };
  if (has("historic", "palace") || has("building", "palace")) return { category: "palace", tags: ["history", "architecture"], visitMinutes: 75, indoor: true, kidFriendly: false };
  // Memorial plaques are everywhere in OSM and almost never worth a stop.
  if (has("historic", "memorial")) return null;
  if (has("historic", "monument")) return { category: "monument", tags: ["history", "photography", "free"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("historic", "ruins") || has("historic", "archaeological_site")) return { category: "landmark", tags: ["history", "walking"], visitMinutes: 60, indoor: false, kidFriendly: true };
  if (has("amenity", "place_of_worship")) {
    const religion = t.religion;
    const category: PlaceCategory = religion === "shinto" ? "shrine" : religion === "buddhist" || religion === "hindu" ? "temple" : "church";
    const extra: PlaceTag[] = religion === "jewish" ? ["jewish"] : [];
    return { category, tags: ["religion", "history", "architecture", ...extra], visitMinutes: 30, indoor: true, kidFriendly: true };
  }
  if (has("leisure", "park") || has("leisure", "garden")) return { category: has("leisure", "garden") ? "garden" : "park", tags: ["nature", "kids", "free", "walking"], visitMinutes: 60, indoor: false, kidFriendly: true };
  if (has("natural", "beach")) return { category: "beach", tags: ["beaches", "nature", "free", "kids"], visitMinutes: 120, indoor: false, kidFriendly: true };
  if (has("amenity", "marketplace")) return { category: "market", tags: ["food", "local", "shopping"], visitMinutes: 45, indoor: false, kidFriendly: true };
  if (has("man_made", "tower") && wiki) return { category: "tower", tags: ["views", "architecture", "attractions"], visitMinutes: 45, indoor: false, kidFriendly: true };
  if (has("man_made", "bridge") && wiki) return { category: "bridge", tags: ["architecture", "photography", "free"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("place", "square") && wiki) return { category: "square", tags: ["city", "free", "walking"], visitMinutes: 20, indoor: false, kidFriendly: true };
  if (has("tourism", "attraction")) return { category: "landmark", tags: ["iconic", "photography"], visitMinutes: 45, indoor: false, kidFriendly: true };
  return null;
}

function iconicityOf(tags: Record<string, string>): number {
  if (tags.wikipedia && tags.wikidata) return 0.7;
  if (tags.wikidata) return 0.5;
  return 0.3;
}

/** Notability from the number of Wikipedia language editions: 0 links -> 0.3, ~40 -> 0.86, 150+ -> 1. */
export function iconicityFromSitelinks(sitelinks: number): number {
  return Math.min(1, Math.round((0.3 + 0.35 * Math.log10(1 + sitelinks)) * 100) / 100);
}

/** Apply Wikidata notability and labels to places that have a wikidata id. */
export function enrichWithWikidata(places: PlaceSeed[], facts: Map<string, WikidataFacts>): PlaceSeed[] {
  return places.map((p) => {
    const f = p.wikidata ? facts.get(p.wikidata) : undefined;
    if (!f) return p;
    const names = { ...p.names };
    for (const [lang, label] of Object.entries(f.labels)) {
      const key = lang === "zh" ? "zh-CN" : lang;
      if (!names[key]) names[key] = label;
    }
    return { ...p, names, iconicity: iconicityFromSitelinks(f.sitelinks) };
  });
}

/** The opening_hours string itself when the parser accepts it, else null (OSM tagging is free text and sometimes broken). */
export function parseableHours(value: string | null, lat: number, lng: number, countryCode: string): string | null {
  if (!value) return null;
  const parses = (v: string) => {
    try {
      new opening_hours(v, { lat, lon: lng, address: { country_code: countryCode.toLowerCase(), state: "" } });
      return true;
    } catch {
      return false;
    }
  };
  if (parses(value)) return value;
  // The parser knows no public holidays for many countries (Cyprus, most of Asia and Africa) and
  // rejects any "PH" rule there. The rest of the hours is still right: keep it without the holiday part.
  const withoutHolidays = value
    .split(";")
    .map((rule) => rule.replace(/\s*,\s*PH\b|\bPH\s*,\s*/gi, "").trim())
    .filter((rule) => rule && !/^PH\b/i.test(rule))
    .join("; ");
  return withoutHolidays && withoutHolidays !== value && parses(withoutHolidays) ? withoutHolidays : null;
}

export function toPlace(el: OverpassElement, city: CitySeed): PlaceSeed | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  const name = tags.name;
  if (lat === undefined || lng === undefined || !name) return null;
  const cls = classify(tags);
  if (!cls) return null;
  const en = tags["name:en"] ?? name;
  const he = tags["name:he"];
  const names: { en: string; local: string; [k: string]: string } = { en, local: name };
  if (he) names.he = he;
  for (const l of ["ar", "ru", "es", "fr", "de", "it", "pt", "ja", "hi"]) if (tags[`name:${l}`]) names[l] = tags[`name:${l}`];
  if (tags["name:zh"]) names["zh-CN"] = tags["name:zh"];
  // Hours are kept only when the planner's parser accepts them; a string it rejects would not be checkable anyway.
  const openingHours = parseableHours(tags.opening_hours?.trim() || null, lat, lng, city.countryCode);
  const wheelchair = tags.wheelchair === "yes" || tags.wheelchair === "limited" || tags.wheelchair === "no" ? tags.wheelchair : "unknown";
  const website = (tags.website ?? tags["contact:website"] ?? "").split(";")[0].trim();
  let siteUrl: string | null = null;
  if (website) {
    try {
      siteUrl = new URL(website.startsWith("http") ? website : `https://${website}`).toString();
    } catch {
      siteUrl = null;
    }
  }
  const place: PlaceSeed = {
    id: `${city.countryCode.toLowerCase()}-${city.slug}-${slugify(name) || "place"}-${el.id}`,
    externalId: `osm:${el.type}:${el.id}`,
    countryCode: city.countryCode,
    city: city.slug,
    nameLocal: name,
    names,
    category: cls.category,
    tags: cls.tags,
    lat,
    lng,
    elevationM: null,
    openingHours,
    closedDates: [],
    visitMinutes: cls.visitMinutes,
    iconicity: iconicityOf(tags),
    minAge: null,
    wheelchair,
    strollerOk: null,
    priceLevel: tags.fee === "no" ? 0 : tags.fee === "yes" ? 1 : null,
    website: siteUrl,
    ticketUrl: null,
    requiresAdvanceBooking: false,
    indoor: cls.indoor,
    kidFriendly: cls.kidFriendly,
    dataQuality: openingHours ? "verified" : "partial",
    source: "osm",
    wikidata: tags.wikidata && /^Q\d+$/.test(tags.wikidata) ? tags.wikidata : null,
  };
  const parsed = placeSeedSchema.safeParse(place);
  return parsed.success ? parsed.data : null;
}

/**
 * The places worth shipping for a city: most notable first, duplicates (same OSM
 * object or same name) dropped, and a floor of variety so a city of churches still
 * offers its parks, viewpoints, markets and beaches. `limit` caps the total.
 */
export function selectPlaces(places: PlaceSeed[], limit = 80): PlaceSeed[] {
  const ranked = [...places].sort((a, b) => b.iconicity - a.iconicity || (b.openingHours ? 1 : 0) - (a.openingHours ? 1 : 0));
  const seen = new Set<string>();
  // Places of worship: in Italy nearly every village church has an article, and they crowd out villas,
  // gardens and museums. At most a quarter of the city, except the major ones.
  const worship = new Set<PlaceCategory>(["church", "shrine", "temple"]);
  // Viewpoints without an article are often unnamed terraces ("Terrace", "Belvedere"): they only come in
  // through the variety floor below, never as filler when an area has few candidates.
  const minorView = (p: PlaceSeed) => p.category === "viewpoint" && !p.wikidata;
  const distinct = new Set(places.filter((p) => !minorView(p)).map((p) => p.externalId ?? p.id)).size;
  const worshipCap = Math.ceil(Math.min(limit, distinct) / 4);
  let worshipKept = 0;
  const unique = ranked.filter((p) => {
    const keys = [p.externalId ?? p.id, p.nameLocal.toLowerCase()];
    if (keys.some((k) => seen.has(k))) return false;
    if (minorView(p)) return false;
    if (worship.has(p.category) && p.iconicity < 0.8) {
      if (worshipKept >= worshipCap) return false;
      worshipKept++;
    }
    keys.forEach((k) => seen.add(k));
    return true;
  });
  const top = unique.slice(0, limit);
  // A few unnamed viewpoints are still welcome for breathing room.
  const views = ranked.filter((p) => minorView(p) && !seen.has(p.externalId ?? p.id)).slice(0, Math.max(0, 3 - top.filter((p) => p.category === "viewpoint").length));
  if (unique.length <= limit) return [...top, ...views].slice(0, limit);
  // Variety floor: up to three of each "breathing" category from beyond the cut.
  const breathing: PlaceCategory[] = ["park", "garden", "viewpoint", "market", "beach", "square", "neighborhood", "waterfront"];
  const picked = new Set(top.map((p) => p.id));
  const extras: PlaceSeed[] = [];
  const beyond = [...unique.slice(limit), ...ranked.filter((p) => minorView(p) && !seen.has(p.externalId ?? p.id))];
  for (const cat of breathing) {
    const have = top.filter((p) => p.category === cat).length;
    for (const p of beyond) {
      if (have + extras.filter((x) => x.category === cat).length >= 3) break;
      if (p.category === cat && !picked.has(p.id)) {
        extras.push(p);
        picked.add(p.id);
      }
    }
  }
  if (extras.length === 0) return top;
  // Make room by dropping the least notable of the over-represented categories.
  const keep = top.slice();
  for (const extra of extras) {
    const victim = [...keep].reverse().find((p) => !breathing.includes(p.category) && !(p.wikidata && p.iconicity >= 0.8));
    if (victim) keep.splice(keep.indexOf(victim), 1);
    keep.push(extra);
  }
  return keep.sort((a, b) => b.iconicity - a.iconicity);
}

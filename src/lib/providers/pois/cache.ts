import "server-only";
import { prisma } from "@/lib/db";
import { placeSeedSchema, type CitySeed, type PlaceSeed } from "@/lib/data/schemas";
import { OSM_PROVIDER_VERSION } from "./osm";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * OSM places are cached in the Place table (source "osm") per city slug for 30 days,
 * so a destination is fetched from Overpass once, not on every plan.
 */
export async function readCachedPlaces(city: CitySeed): Promise<PlaceSeed[] | null> {
  const rows = await prisma.place.findMany({ where: { city: city.slug, source: "osm", sourceVersion: OSM_PROVIDER_VERSION } });
  if (rows.length === 0) return null;
  const newest = Math.max(...rows.map((r) => r.updatedAt.getTime()));
  if (Date.now() - newest > TTL_MS) return null;
  const out: PlaceSeed[] = [];
  for (const r of rows) {
    const parsed = placeSeedSchema.safeParse({
      id: r.id,
      externalId: r.externalId,
      countryCode: r.countryCode,
      city: r.city,
      nameLocal: r.nameLocal,
      names: JSON.parse(r.names),
      category: r.category,
      tags: JSON.parse(r.tags),
      lat: r.lat,
      lng: r.lng,
      elevationM: r.elevationM,
      openingHours: r.openingHours,
      closedDates: r.closedDates ? JSON.parse(r.closedDates) : [],
      visitMinutes: r.visitMinutes,
      iconicity: r.iconicity,
      minAge: r.minAge,
      wheelchair: r.wheelchair ?? "unknown",
      strollerOk: r.strollerOk,
      priceLevel: r.priceLevel,
      website: r.website,
      ticketUrl: r.ticketUrl,
      requiresAdvanceBooking: r.requiresAdvanceBooking,
      indoor: ["museum", "gallery", "aquarium", "church", "shrine", "temple", "palace"].includes(r.category),
      kidFriendly: !["nightlife", "gallery", "palace"].includes(r.category),
      dataQuality: r.dataQuality,
      source: r.source,
      wikidata: r.wikidata,
    });
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function writeCachedPlaces(places: PlaceSeed[]): Promise<void> {
  const cities = [...new Set(places.map((p) => p.city))];
  await prisma.place.deleteMany({ where: { city: { in: cities }, source: "osm", sourceVersion: { not: OSM_PROVIDER_VERSION } } });
  for (const p of places) {
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
      sourceVersion: OSM_PROVIDER_VERSION,
      wikidata: p.wikidata,
    };
    await prisma.place.upsert({ where: { id: p.id }, create: { id: p.id, ...row }, update: row });
  }
}

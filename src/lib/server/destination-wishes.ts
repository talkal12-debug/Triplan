import "server-only";
import { getSeedCities } from "@/lib/data/pois";
import { getWorldCities } from "@/lib/data/world";
import { normalizeName } from "@/lib/nearby/must-visit-core";
import type { TripPreferences } from "@/lib/planner/types";

/**
 * "Lake Como" typed as a must-visit place on a Milan trip is a destination, not a stop: there is
 * no single point to visit. When a free-text wish names a catalogue city or area of a country in
 * the trip (in any language), it becomes a destination with one day (a day trip from the first
 * city) instead of an unresolved wish. Places with an id are left alone.
 */
export function promoteDestinationWishes(prefs: TripPreferences, notes?: string[]): TripPreferences {
  if (prefs.mustVisit.every((m) => m.placeId)) return prefs;
  let destinations = prefs.destinations;
  const mustVisit = prefs.mustVisit.filter((wish) => {
    if (wish.placeId) return true;
    const q = normalizeName(wish.name);
    if (q.length < 3) return true;
    for (const dest of destinations) {
      const seeded = getSeedCities(dest.countryCode);
      const city = [...seeded, ...getWorldCities(dest.countryCode)].find((c) => Object.values(c.names).some((n) => normalizeName(n) === q));
      if (!city) continue;
      if (dest.cities.length === 0) return true; // the planner chooses the cities anyway
      destinations = destinations.map((d) => {
        if (d !== dest) return d;
        const isSeed = seeded.some((c) => c.slug === city.slug);
        const custom = isSeed || (d.customCities ?? []).some((c) => c.slug === city.slug) ? d.customCities : [...(d.customCities ?? []), { slug: city.slug, names: { ...city.names, en: city.names.en }, center: city.center, bbox: city.bbox }];
        return {
          ...d,
          cities: d.cities.includes(city.slug) ? d.cities : [...d.cities, city.slug],
          customCities: custom,
          cityDays: { ...(d.cityDays ?? {}), [city.slug]: d.cityDays?.[city.slug] ?? 1 },
        };
      });
      notes?.push(`wishlist: "${wish.name}" is a destination, added as ${city.slug} for one day`);
      return false;
    }
    return true;
  });
  return mustVisit.length === prefs.mustVisit.length ? prefs : { ...prefs, destinations, mustVisit };
}

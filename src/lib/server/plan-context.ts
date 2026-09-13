import "server-only";
import { getSeedCities, getSeedPlaces } from "@/lib/data/pois";
import { isDemoCountry, getCountry, countryName } from "@/lib/data/countries";
import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import type { TripPreferences } from "@/lib/planner/types";
import type { Itinerary, PlannerCity } from "@/lib/planner/itinerary";
import { refineTravel } from "@/lib/planner/refine";
import { getCurrency, getHolidays, getRouting, getWeather, placesForCity, tryProvider } from "@/lib/providers/registry";
import type { DailyWeather, PublicHoliday, Rates } from "@/lib/providers/types";
import { affiliateIdsFromEnv, carLinks, flightLinks, hotelLinks, ticketLinks, type AffiliateLink } from "@/lib/providers/affiliate";
import { tripEndDate } from "@/lib/planner/types";
import type { Locale } from "@/lib/i18n/locales";
import { nearestAirport } from "@/lib/data/airports";
import { originAirport } from "@/lib/server/origin-airport";
import { borrowBeaches } from "@/lib/planner/beaches";
import { sleepZones as sleepZonesFor, type SleepZone } from "@/lib/planner/sleep-zones";
import { LINKS_VERSION } from "@/lib/links-version";
import { buildNearby } from "./nearby-plan";
import type { Evening, Venue } from "@/lib/nearby/schema";
import { seasonalFor, type SeasonalItem } from "@/lib/data/seasonal";
import { seniorInfoFor, type SeniorInfo } from "@/lib/data/senior-discounts";

export type PlanContext = {
  places: PlaceSeed[];
  cities: PlannerCity[];
  notes: string[];
};

/**
 * Places and cities for the trip's destinations: curated seed for demo countries,
 * OpenStreetMap (cached) for cities the traveller picked elsewhere.
 */
export async function loadPlanContext(prefs: TripPreferences): Promise<PlanContext> {
  const notes: string[] = [];
  const cities: CitySeed[] = [];
  const places: PlaceSeed[] = [];
  for (const dest of prefs.destinations) {
    const code = dest.countryCode.toUpperCase();
    let destCities: CitySeed[];
    if (isDemoCountry(code)) {
      const all = getSeedCities(code);
      destCities = dest.cities.length ? all.filter((c) => dest.cities.includes(c.slug)) : all;
    } else {
      destCities = (dest.customCities ?? []).map((c) => ({ slug: c.slug, countryCode: code, names: c.names, center: c.center, bbox: c.bbox }));
    }
    for (const city of destCities) {
      cities.push(city);
      places.push(...(await placesForCity(city, notes)));
    }
    // Beach holiday: the coast is often filed under another demo city (Lisbon's beaches under Sintra).
    if (prefs.tripStyle === "relax" && isDemoCountry(code)) {
      const have = new Set(places.map((p) => p.id));
      const others = getSeedCities(code).filter((c) => !destCities.some((d) => d.slug === c.slug));
      const borrowed = borrowBeaches(others.flatMap((c) => getSeedPlaces(code, c.slug)), destCities).filter((p) => !have.has(p.id));
      places.push(...borrowed);
      if (borrowed.length) notes.push(`relax: borrowed ${borrowed.length} beaches from nearby cities`);
    }
  }
  return { places, cities, notes };
}

export type PlanExtras = {
  weather: Record<string, DailyWeather & { kind: "forecast" | "normals" }>;
  weatherSource: string | null;
  holidays: PublicHoliday[];
  rates: Rates | null;
  links: {
    hotels: { stayId: string; links: AffiliateLink[] }[];
    tickets: Record<string, AffiliateLink[]>;
    flights: AffiliateLink[];
    cars: AffiliateLink[];
    /** "Where to sleep": areas per stay, ranked, each with hotel searches around its anchor place. */
    sleepZones: { stayId: string; zones: (SleepZone & { links: AffiliateLink[] })[] }[];
    version: number;
  };
  providers: Record<string, string>;
  notes: string[];
  dining: Record<string, Venue[]>;
  evenings: Record<string, Evening>;
  seasonal: (SeasonalItem & { firstDate: string })[];
  seniors: SeniorInfo | null;
};

/** Seasonal highlights for the dates and 65+ discounts for the places, from the curated files. */
export function buildHighlights(prefs: TripPreferences, itinerary: Itinerary): Pick<PlanExtras, "seasonal" | "seniors"> {
  const seasonal = seasonalFor(prefs.destinations, prefs.dates.start, prefs.dates.days);
  const placeIds = itinerary.days.flatMap((d) => d.activities.map((a) => a.placeId).filter((id): id is string => Boolean(id)));
  const seniors = prefs.party.seniors > 0 ? seniorInfoFor(prefs.destinations.map((d) => d.countryCode), placeIds) : null;
  return { seasonal, seniors };
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Weather + holidays before planning (they influence the plan). */
export async function loadSignals(prefs: TripPreferences, cities: PlannerCity[], notes: string[]) {
  const weatherProvider = getWeather();
  const weather: PlanExtras["weather"] = {};
  let weatherSource: string | null = null;
  // One call per distinct city; the first city's forecast fills days without a match.
  for (const city of cities) {
    const result = await tryProvider(`weather:${city.slug}`, () => weatherProvider.daily(city.center, prefs.dates.start, prefs.dates.days), null, notes);
    if (!result || result.kind === "none") continue;
    weatherSource ??= result.source;
    for (const d of result.days) if (!weather[d.date]) weather[d.date] = { ...d, kind: result.kind };
  }

  const holidayProvider = getHolidays();
  const holidays: PublicHoliday[] = [];
  const end = tripEndDate(prefs.dates);
  const years = new Set([Number(prefs.dates.start.slice(0, 4)), Number(end.slice(0, 4))]);
  for (const dest of prefs.destinations) {
    for (const year of years) {
      const list = await tryProvider(`holidays:${dest.countryCode}:${year}`, () => holidayProvider.holidays(dest.countryCode, year), [] as PublicHoliday[], notes);
      holidays.push(...list.filter((h) => h.date >= prefs.dates.start && h.date <= end));
    }
  }
  return { weather, weatherSource, holidays, providerNames: { weather: weatherProvider.name, holidays: holidayProvider.name } };
}

/** Everything the UI shows around the plan: real travel times, currency, booking links. */
export async function enrichPlan(
  prefs: TripPreferences,
  itinerary: Itinerary,
  ctx: PlanContext,
  signals: Awaited<ReturnType<typeof loadSignals>>,
  locale: Locale,
  dayIndexes?: number[],
): Promise<{ itinerary: Itinerary; extras: PlanExtras }> {
  const notes = [...ctx.notes];
  const routing = getRouting();
  const currencyProvider = getCurrency();
  const destCurrency = getCountry(prefs.destinations[0].countryCode)?.currencies[0]?.code ?? "EUR";
  const started = Date.now();
  // Independent network work runs side by side: the plan request has a fixed time budget on
  // serverless hosting, and each of these can take several seconds on public servers.
  const [refined, rates, nearby] = await Promise.all([
    refineTravel(itinerary, { prefs, places: ctx.places, cities: ctx.cities }, (points, mode) => routing.matrix(points, mode), dayIndexes),
    destCurrency === prefs.budget.currency ? Promise.resolve(null) : tryProvider("currency", () => currencyProvider.rates(destCurrency, [prefs.budget.currency]), null, notes),
    // Venues depend on which places are visited, not on the refined times.
    buildNearby(prefs, itinerary, ctx, locale, notes),
  ]);
  if (refined.refinedDays.length === 0 && routing.name !== "estimate") notes.push("routing: no day could be refined, times are estimates");
  notes.push(`timing: enrich ${((Date.now() - started) / 1000).toFixed(1)}s`);

  const links = await buildPlanLinks(prefs, refined.itinerary, ctx, locale);

  return {
    itinerary: refined.itinerary,
    extras: {
      weather: signals.weather,
      weatherSource: signals.weatherSource,
      holidays: signals.holidays,
      rates,
      links,
      providers: { routing: refined.refinedDays.length ? routing.name : "estimate", currency: rates ? currencyProvider.name : "none", ...signals.providerNames, nearby: "openstreetmap", events: nearby.eventsProvider },
      notes,
      dining: nearby.dining,
      evenings: nearby.evenings,
      ...buildHighlights(prefs, refined.itinerary),
    },
  };
}

/** Booking deep links for a plan: hotels per stay, tickets for paid/booked places, flights, car rental. */
export async function buildPlanLinks(prefs: TripPreferences, itinerary: Itinerary, ctx: Pick<PlanContext, "places" | "cities">, locale: Locale): Promise<PlanExtras["links"]> {
  const ids = affiliateIdsFromEnv();
  const endDate = tripEndDate(prefs.dates);
  // Partner sites get English city names: their search understands "Rome", not every UI language.
  const cityName = (slug: string) => {
    const c = ctx.cities.find((x) => x.slug === slug);
    return c ? c.names.en : slug;
  };
  const hotels = itinerary.stays.map((s) => ({
    stayId: s.id,
    links: hotelLinks(
      {
        city: cityName(s.citySlug),
        countryName: getCountry(s.countryCode) ? countryName(getCountry(s.countryCode)!, "en") : undefined,
        countryCode: s.countryCode,
        checkIn: addDays(prefs.dates.start, s.fromDay),
        checkOut: addDays(prefs.dates.start, s.toDay + 1),
        adults: prefs.party.adults,
        childrenAges: prefs.party.childrenAges,
        type: prefs.hotel.type,
      },
      ids,
    ),
  }));
  // "Where to sleep": the areas closest to every day of the stay, each with hotel searches around its anchor place.
  const placePoints = Object.fromEntries(ctx.places.map((p) => [p.id, { lat: p.lat, lng: p.lng }]));
  const sleepZones = itinerary.stays.map((s) => ({
    stayId: s.id,
    zones: sleepZonesFor(itinerary, placePoints, s.id).map((z) => {
      const anchor = ctx.places.find((p) => p.id === z.anchorPlaceId);
      return {
        ...z,
        links: hotelLinks(
          {
            city: anchor ? `${anchor.names.en}, ${cityName(s.citySlug)}` : cityName(s.citySlug),
            countryName: getCountry(s.countryCode) ? countryName(getCountry(s.countryCode)!, "en") : undefined,
            countryCode: s.countryCode,
            checkIn: addDays(prefs.dates.start, s.fromDay),
            checkOut: addDays(prefs.dates.start, s.toDay + 1),
            adults: prefs.party.adults,
            childrenAges: prefs.party.childrenAges,
            type: prefs.hotel.type,
          },
          ids,
        ),
      };
    }),
  }));
  const tickets: Record<string, AffiliateLink[]> = {};
  const placeById = new Map(ctx.places.map((p) => [p.id, p]));
  for (const day of itinerary.days) {
    for (const a of day.activities) {
      const p = a.placeId ? placeById.get(a.placeId) : undefined;
      if (!p || (!p.requiresAdvanceBooking && (p.priceLevel ?? 0) < 1)) continue;
      tickets[p.id] = ticketLinks({ placeName: p.names.en, city: cityName(day.citySlug), date: day.date }, ids);
    }
  }
  const first = ctx.cities[0];
  const last = ctx.cities[ctx.cities.length - 1];
  const countryEn = (code: string) => (getCountry(code) ? countryName(getCountry(code)!, "en") : undefined);
  // Flights: from the traveller's city when they told us, else a locale default (Israelis fly from Tel Aviv).
  const origin = (prefs.dates.origin ?? "").trim() || (locale === "he" ? "Tel Aviv" : "");
  const originAp = origin ? await originAirport(origin) : null;
  const flights = first
    ? flightLinks(
        {
          originCity: originAp?.city ?? origin,
          originIata: originAp?.iata ?? null,
          destinationCity: first.names.en,
          destinationCountryName: countryEn(first.countryCode),
          destinationIata: nearestAirport(first.center)?.iata ?? null,
          departDate: prefs.dates.start,
          returnDate: endDate,
          adults: prefs.party.adults,
          children: prefs.party.childrenAges.length + prefs.party.infants,
        },
        ids,
      )
    : [];
  // Car rental only when the traveller wants to drive: pick up in the first area, drop off in the last.
  const cars =
    first && prefs.transport.car > 0
      ? carLinks(
          {
            pickUpCity: first.names.en,
            dropOffCity: (last ?? first).names.en,
            countryName: countryEn(first.countryCode),
            pickUpDate: prefs.dates.start,
            dropOffDate: endDate,
          },
          ids,
        )
      : [];

  return { hotels, sleepZones, tickets, flights, cars, version: LINKS_VERSION };
}

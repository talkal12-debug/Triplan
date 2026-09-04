import "server-only";
import { getSeedCities } from "@/lib/data/pois";
import { isDemoCountry, getCountry, countryName } from "@/lib/data/countries";
import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import type { TripPreferences } from "@/lib/planner/types";
import type { Itinerary, PlannerCity } from "@/lib/planner/itinerary";
import { refineTravel } from "@/lib/planner/refine";
import { getCurrency, getHolidays, getRouting, getWeather, placesForCity, tryProvider } from "@/lib/providers/registry";
import type { DailyWeather, PublicHoliday, Rates } from "@/lib/providers/types";
import { affiliateIdsFromEnv, flightLinks, hotelLinks, ticketLinks, type AffiliateLink } from "@/lib/providers/affiliate";
import { tripEndDate } from "@/lib/planner/types";
import type { Locale } from "@/lib/i18n/locales";

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
  };
  providers: Record<string, string>;
  notes: string[];
};

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
  const refined = await refineTravel(itinerary, { prefs, places: ctx.places, cities: ctx.cities }, (points, mode) => routing.matrix(points, mode), dayIndexes);
  if (refined.refinedDays.length === 0 && routing.name !== "estimate") notes.push("routing: no day could be refined, times are estimates");

  const currencyProvider = getCurrency();
  const destCurrency = getCountry(prefs.destinations[0].countryCode)?.currencies[0]?.code ?? "EUR";
  const rates =
    destCurrency === prefs.budget.currency
      ? null
      : await tryProvider("currency", () => currencyProvider.rates(destCurrency, [prefs.budget.currency]), null, notes);

  const ids = affiliateIdsFromEnv();
  const endDate = tripEndDate(prefs.dates);
  const cityName = (slug: string) => {
    const c = ctx.cities.find((x) => x.slug === slug);
    return c ? (c.names[locale] ?? c.names.en) : slug;
  };
  const hotels = refined.itinerary.stays.map((s) => ({
    stayId: s.id,
    links: hotelLinks(
      {
        city: cityName(s.citySlug),
        countryName: getCountry(s.countryCode) ? countryName(getCountry(s.countryCode)!, "en") : undefined,
        checkIn: addDays(prefs.dates.start, s.fromDay),
        checkOut: addDays(prefs.dates.start, s.toDay + 1),
        adults: prefs.party.adults,
        childrenAges: prefs.party.childrenAges,
        type: prefs.hotel.type,
      },
      ids,
    ),
  }));
  const tickets: Record<string, AffiliateLink[]> = {};
  const placeById = new Map(ctx.places.map((p) => [p.id, p]));
  for (const day of refined.itinerary.days) {
    for (const a of day.activities) {
      const p = a.placeId ? placeById.get(a.placeId) : undefined;
      if (!p || (!p.requiresAdvanceBooking && (p.priceLevel ?? 0) < 1)) continue;
      tickets[p.id] = ticketLinks({ placeName: p.names.en, city: cityName(day.citySlug), date: day.date }, ids);
    }
  }
  const first = ctx.cities[0];
  const flights = first
    ? flightLinks(
        {
          destinationCity: first.names.en,
          destinationCountryCode: first.countryCode,
          departDate: prefs.dates.start,
          returnDate: endDate,
          adults: prefs.party.adults,
          children: prefs.party.childrenAges.length + prefs.party.infants,
        },
        ids,
      )
    : [];

  return {
    itinerary: refined.itinerary,
    extras: {
      weather: signals.weather,
      weatherSource: signals.weatherSource,
      holidays: signals.holidays,
      rates,
      links: { hotels, tickets, flights },
      providers: { routing: refined.refinedDays.length ? routing.name : "estimate", currency: rates ? currencyProvider.name : "none", ...signals.providerNames },
      notes,
    },
  };
}

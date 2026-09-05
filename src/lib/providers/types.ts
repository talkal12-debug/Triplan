import type { CitySeed, PlaceSeed } from "@/lib/data/schemas";
import type { LatLng } from "@/lib/planner/geo";
import type { TravelMode } from "@/lib/planner/itinerary";

/**
 * One interface per data category. Every category has a real implementation
 * (free, key-less where possible) and a mock that works offline, so the whole
 * app runs without a single API key. The registry picks by environment.
 */

export type TravelMatrix = {
  /** minutes[i][j] from points[i] to points[j]; null when unroutable */
  minutes: (number | null)[][];
  meters: (number | null)[][];
  estimated: boolean;
};

export type RouteGeometry = {
  /** [lng, lat] pairs along real streets, in order */
  coordinates: [number, number][];
  meters: number;
  minutes: number;
};

export interface RoutingProvider {
  readonly name: string;
  /** Pairwise travel matrix for up to ~25 points. */
  matrix(points: LatLng[], mode: TravelMode): Promise<TravelMatrix>;
  /** Street geometry through the points in order, or null when the provider cannot (estimates, transit). */
  route(points: LatLng[], mode: TravelMode): Promise<RouteGeometry | null>;
}

export type DailyWeather = {
  date: string;
  /** 0..100 */
  precipProbability: number;
  precipMm: number | null;
  tempMax: number | null;
  tempMin: number | null;
  /** WMO weather code when available */
  code: number | null;
};

export type WeatherResult = {
  /** "forecast" for the next ~16 days, "normals" = same dates last year, "none" = unknown */
  kind: "forecast" | "normals" | "none";
  days: DailyWeather[];
  source: string;
};

export interface WeatherProvider {
  readonly name: string;
  daily(point: LatLng, startDate: string, days: number): Promise<WeatherResult>;
}

export type PublicHoliday = { date: string; name: string; localName: string; countryCode: string };

export interface HolidayProvider {
  readonly name: string;
  holidays(countryCode: string, year: number): Promise<PublicHoliday[]>;
}

export type Rates = { base: string; date: string; rates: Record<string, number>; source: string };

export interface CurrencyProvider {
  readonly name: string;
  rates(base: string, symbols: string[]): Promise<Rates>;
}

export interface PoiProvider {
  readonly name: string;
  /** Cities / areas matching a query inside a country, localised names when available. */
  searchCities(countryCode: string, query: string, locale: string): Promise<CitySeed[]>;
  /** Attractions for a city area. May be slow (Overpass) and is cached by the caller. */
  placesForCity(city: CitySeed): Promise<PlaceSeed[]>;
}

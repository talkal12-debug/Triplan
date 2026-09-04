import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { DailyWeather, WeatherProvider, WeatherResult } from "../types";
import type { LatLng } from "@/lib/planner/geo";

const forecastSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    precipitation_probability_max: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()).optional(),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    weather_code: z.array(z.number().nullable()).optional(),
  }),
});

const archiveSchema = z.object({
  daily: z.object({
    time: z.array(z.string()),
    precipitation_sum: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
  }),
});

const FORECAST_DAYS = 16;

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso: string, today = new Date()): number {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - t) / 86_400_000);
}

/**
 * Open-Meteo, free and key-less.
 * Within 16 days: the real forecast. Further out: the same dates one year earlier from
 * the ERA5 archive, labelled "normals" so the UI never presents them as a forecast.
 */
export const openMeteo: WeatherProvider = {
  name: "open-meteo",
  async daily(point: LatLng, startDate: string, days: number): Promise<WeatherResult> {
    const lat = point.lat.toFixed(2);
    const lng = point.lng.toFixed(2);
    const end = addDays(startDate, days - 1);
    const lead = daysUntil(startDate);

    if (lead >= -1 && daysUntil(end) < FORECAST_DAYS) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&start_date=${startDate}&end_date=${end}`;
      const data = await fetchJson(url, { provider: "open-meteo", schema: forecastSchema, cacheKey: url, ttlMs: 3 * 60 * 60 * 1000 });
      const out: DailyWeather[] = data.daily.time.map((date, i) => ({
        date,
        precipProbability: data.daily.precipitation_probability_max[i] ?? 0,
        precipMm: data.daily.precipitation_sum?.[i] ?? null,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        code: data.daily.weather_code?.[i] ?? null,
      }));
      return { kind: "forecast", days: out, source: "Open-Meteo forecast" };
    }

    // Same dates last year (archive lags a few days behind today).
    const lastYearStart = addDays(startDate, -365);
    const lastYearEnd = addDays(end, -365);
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${lastYearStart}&end_date=${lastYearEnd}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;
    const data = await fetchJson(url, { provider: "open-meteo-archive", schema: archiveSchema, cacheKey: url, ttlMs: 24 * 60 * 60 * 1000 });
    const out: DailyWeather[] = data.daily.time.map((date, i) => {
      const mm = data.daily.precipitation_sum[i];
      return {
        date: addDays(date, 365),
        // A rainy day last year is a hint, not a forecast: cap the probability.
        precipProbability: mm === null ? 0 : mm >= 5 ? 60 : mm >= 1 ? 35 : 10,
        precipMm: mm,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        code: null,
      };
    });
    return { kind: "normals", days: out, source: "Open-Meteo archive (same dates last year)" };
  },
};

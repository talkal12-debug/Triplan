import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { EventItem } from "@/lib/nearby/schema";

/**
 * Events on the trip's dates near the hotel, from the Ticketmaster Discovery API
 * (free developer key: https://developer.ticketmaster.com). Without
 * TICKETMASTER_API_KEY no events are fetched and the UI shows search links instead.
 * Coverage is strongest in North America and Western Europe.
 */
export type EventsQuery = { lat: number; lng: number; radiusKm: number; start: string; end: string; locale: string };

export interface EventsProvider {
  readonly name: string;
  search(q: EventsQuery): Promise<EventItem[]>;
}

const responseSchema = z.object({
  _embedded: z
    .object({
      events: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          url: z.string().optional(),
          dates: z.object({ start: z.object({ localDate: z.string().optional(), localTime: z.string().optional(), dateTime: z.string().optional() }) }),
          classifications: z.array(z.object({ segment: z.object({ name: z.string() }).optional(), genre: z.object({ name: z.string() }).optional() })).optional(),
          priceRanges: z.array(z.object({ min: z.number().optional(), max: z.number().optional(), currency: z.string().optional() })).optional(),
          images: z.array(z.object({ url: z.string(), width: z.number().optional(), ratio: z.string().optional() })).optional(),
          _embedded: z.object({ venues: z.array(z.object({ name: z.string().optional() })).optional() }).optional(),
        }),
      ),
    })
    .optional(),
});

export const ticketmasterEvents: EventsProvider = {
  name: "ticketmaster",
  async search(q) {
    const key = process.env.TICKETMASTER_API_KEY;
    if (!key) return [];
    const params = new URLSearchParams({
      apikey: key,
      latlong: `${q.lat.toFixed(4)},${q.lng.toFixed(4)}`,
      radius: String(Math.round(q.radiusKm)),
      unit: "km",
      startDateTime: `${q.start}T00:00:00Z`,
      endDateTime: `${q.end}T23:59:59Z`,
      sort: "date,asc",
      size: "40",
      locale: q.locale === "he" ? "*" : q.locale,
    });
    const data = await fetchJson(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`, {
      provider: "ticketmaster",
      schema: responseSchema,
      timeoutMs: 10_000,
      cacheKey: `tm:${params.get("latlong")}:${q.start}:${q.end}`,
      ttlMs: 6 * 60 * 60 * 1000,
    });
    return (data._embedded?.events ?? [])
      .filter((e) => e.url)
      .map((e) => ({
        id: e.id,
        name: e.name,
        url: e.url!,
        start: e.dates.start.dateTime ?? `${e.dates.start.localDate ?? q.start}${e.dates.start.localTime ? `T${e.dates.start.localTime}` : ""}`,
        venue: e._embedded?.venues?.[0]?.name ?? null,
        category: e.classifications?.[0]?.genre?.name ?? e.classifications?.[0]?.segment?.name ?? null,
        source: "ticketmaster",
        priceMin: e.priceRanges?.[0]?.min ?? null,
        priceMax: e.priceRanges?.[0]?.max ?? null,
        currency: e.priceRanges?.[0]?.currency ?? null,
        image: e.images?.find((i) => i.ratio === "16_9" && (i.width ?? 0) >= 600)?.url ?? e.images?.[0]?.url ?? null,
      }));
  },
};

/** No key: nothing fetched (the UI is told which provider would answer). */
export const noEvents: EventsProvider = {
  name: "none",
  async search() {
    return [];
  },
};

export function getEvents(): EventsProvider {
  return process.env.TICKETMASTER_API_KEY ? ticketmasterEvents : noEvents;
}

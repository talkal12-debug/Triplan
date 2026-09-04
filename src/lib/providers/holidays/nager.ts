import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { HolidayProvider, PublicHoliday } from "../types";

const schema = z.array(
  z.object({
    date: z.string(),
    localName: z.string(),
    name: z.string(),
    countryCode: z.string(),
    global: z.boolean().optional(),
    types: z.array(z.string()).optional(),
  }),
);

/** Nager.Date: public holidays for ~110 countries, free and key-less. */
export const nagerDate: HolidayProvider = {
  name: "nager-date",
  async holidays(countryCode: string, year: number): Promise<PublicHoliday[]> {
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`;
    const data = await fetchJson(url, { provider: "nager-date", schema, cacheKey: url, ttlMs: 7 * 24 * 60 * 60 * 1000 });
    return data
      .filter((h) => h.global !== false || !h.types || h.types.includes("Public"))
      .map((h) => ({ date: h.date, name: h.name, localName: h.localName, countryCode: h.countryCode }));
  },
};

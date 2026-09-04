import "server-only";
import { z } from "zod";
import { fetchJson } from "../http";
import type { CurrencyProvider, Rates } from "../types";

const schema = z.object({
  base: z.string(),
  date: z.string(),
  rates: z.record(z.string(), z.number()),
});

/** Frankfurter: ECB reference rates, free and key-less. ~30 major currencies. */
export const frankfurter: CurrencyProvider = {
  name: "frankfurter",
  async rates(base: string, symbols: string[]): Promise<Rates> {
    const wanted = symbols.map((s) => s.toUpperCase()).filter((s) => s !== base.toUpperCase());
    if (wanted.length === 0) return { base: base.toUpperCase(), date: new Date().toISOString().slice(0, 10), rates: {}, source: "frankfurter" };
    const url = `https://api.frankfurter.dev/v1/latest?base=${base.toUpperCase()}&symbols=${wanted.join(",")}`;
    const data = await fetchJson(url, { provider: "frankfurter", schema, cacheKey: url, ttlMs: 12 * 60 * 60 * 1000 });
    return { base: data.base, date: data.date, rates: data.rates, source: "frankfurter" };
  },
};

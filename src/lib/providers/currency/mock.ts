import type { CurrencyProvider, Rates } from "../types";

/** Rough rates for offline use. Marked as demo data in the UI. */
const toEur: Record<string, number> = { EUR: 1, USD: 1.16, ILS: 3.5, GBP: 0.86, JPY: 172 };

export const mockCurrency: CurrencyProvider = {
  name: "mock-currency",
  async rates(base: string, symbols: string[]): Promise<Rates> {
    const b = toEur[base.toUpperCase()];
    const rates: Record<string, number> = {};
    for (const s of symbols) {
      const q = toEur[s.toUpperCase()];
      if (b && q) rates[s.toUpperCase()] = Math.round((q / b) * 10000) / 10000;
    }
    return { base: base.toUpperCase(), date: "demo", rates, source: "demo" };
  },
};

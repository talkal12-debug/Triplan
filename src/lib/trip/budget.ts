import type { Itinerary } from "@/lib/planner/itinerary";
import type { TripPreferences } from "@/lib/planner/types";
import type { PlaceSeed } from "@/lib/data/schemas";

/**
 * Rough trip budget. Every number here is a heuristic in EUR, scaled by a country
 * cost index and converted with the plan's exchange rate. The UI says so.
 */
export type BudgetLine = { key: "lodging" | "tickets" | "transport" | "food"; perDay: number; total: number };
export type BudgetEstimate = {
  currency: string;
  perPersonPerDay: number;
  perPersonTotal: number;
  groupTotal: number;
  lines: BudgetLine[];
  people: number;
  nights: number;
  /** true when a real exchange rate was applied; false when shown in EUR */
  converted: boolean;
  /** How the daily cap compares, when the traveller set one: ratio estimate/cap */
  capRatio: number | null;
};

/** Relative price level vs. Western Europe = 1. Rough, public-knowledge ballparks. */
const costIndex: Record<string, number> = {
  CH: 1.5, NO: 1.5, IS: 1.5, DK: 1.3, GB: 1.25, IE: 1.2, US: 1.25, CA: 1.15, AU: 1.2, NZ: 1.15, SG: 1.2, AE: 1.15, IL: 1.2,
  FR: 1.05, NL: 1.1, BE: 1.05, AT: 1.05, DE: 1, IT: 0.95, ES: 0.85, PT: 0.8, GR: 0.8, JP: 0.9, KR: 0.85, CZ: 0.7, PL: 0.6, HU: 0.6, HR: 0.75,
  TR: 0.5, MA: 0.5, EG: 0.4, TH: 0.45, VN: 0.35, ID: 0.4, MX: 0.55, AR: 0.55, GE: 0.45, IN: 0.35, LK: 0.4, CY: 0.85, MT: 0.9, RO: 0.6, BG: 0.55,
};

/** Per room per night, EUR, Western Europe, mid-season. */
const lodgingPerNight: Record<TripPreferences["hotel"]["type"], number> = {
  hostel: 35,
  camping: 30,
  apartment: 110,
  "3star": 100,
  "4star": 160,
  "5star": 320,
  boutique: 190,
};

const foodPerPersonPerDay: Record<TripPreferences["budget"]["level"], number> = { budget: 30, mid: 60, luxury: 130 };
const ticketByPriceLevel = [0, 12, 25, 45, 90];

export function estimateBudget(
  prefs: TripPreferences,
  itinerary: Itinerary,
  places: Record<string, PlaceSeed>,
  rate: { quote: string; value: number } | null,
): BudgetEstimate {
  const country = prefs.destinations[0]?.countryCode.toUpperCase() ?? "";
  const index = costIndex[country] ?? 1;
  const adults = prefs.party.adults;
  const kids = prefs.party.childrenAges.length;
  const people = adults + kids; // infants are free almost everywhere
  const days = itinerary.days.length;
  const nights = Math.max(0, days - 1);
  const rooms = Math.max(1, Math.ceil(people / (prefs.hotel.type === "apartment" ? 4 : 2)));
  const levelMul = prefs.budget.level === "budget" ? 0.75 : prefs.budget.level === "luxury" ? 1.4 : 1;

  const lodgingTotal = lodgingPerNight[prefs.hotel.type] * index * levelMul * rooms * nights;

  let ticketsTotal = 0;
  for (const day of itinerary.days) {
    for (const a of day.activities) {
      const p = a.placeId ? places[a.placeId] : undefined;
      if (!p) continue;
      const adult = ticketByPriceLevel[p.priceLevel ?? 1] * index;
      ticketsTotal += adult * adults + adult * 0.5 * kids;
    }
  }

  const carDays = prefs.transport.car > 0 ? days : 0;
  const transitDays = prefs.transport.transit > 0 ? days : 0;
  const toursDays = prefs.transport.tours > 0 ? Math.ceil(days / 3) : 0;
  const transportTotal = index * (carDays * 55 + transitDays * 8 * people + toursDays * 45 * people);

  const foodTotal = foodPerPersonPerDay[prefs.budget.level] * index * days * (adults + kids * 0.6);

  const conv = rate ? rate.value : 1;
  const raw: BudgetLine[] = [
    { key: "lodging", perDay: (lodgingTotal / Math.max(1, days)) * conv, total: lodgingTotal * conv },
    { key: "tickets", perDay: (ticketsTotal / Math.max(1, days)) * conv, total: ticketsTotal * conv },
    { key: "transport", perDay: (transportTotal / Math.max(1, days)) * conv, total: transportTotal * conv },
    { key: "food", perDay: (foodTotal / Math.max(1, days)) * conv, total: foodTotal * conv },
  ];
  const lines: BudgetLine[] = raw.map((l) => ({ ...l, perDay: Math.round(l.perDay), total: Math.round(l.total) }));

  const groupTotal = lines.reduce((s, l) => s + l.total, 0);
  const perPersonTotal = Math.round(groupTotal / Math.max(1, people));
  const perPersonPerDay = Math.round(perPersonTotal / Math.max(1, days));
  const cap = prefs.budget.dailyCap;
  return {
    currency: rate ? rate.quote : "EUR",
    perPersonPerDay,
    perPersonTotal,
    groupTotal,
    lines,
    people,
    nights,
    converted: Boolean(rate),
    capRatio: cap && rate && rate.quote === prefs.budget.currency ? perPersonPerDay / cap : null,
  };
}

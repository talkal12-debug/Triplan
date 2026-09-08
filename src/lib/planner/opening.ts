import opening_hours from "opening_hours";
import type { PlannerPlace } from "./itinerary";

/**
 * Opening-hours checks on top of the `opening_hours` library (OSM syntax).
 * Unknown or unparseable hours are treated as "probably open" but flagged,
 * never as closed: an empty plan helps nobody.
 */

export type OpenState = "open" | "closed" | "unknown";

const cache = new Map<string, opening_hours | null>();

function parser(place: PlannerPlace): opening_hours | null {
  if (!place.openingHours) return null;
  const key = `${place.countryCode}|${place.openingHours}`;
  if (cache.has(key)) return cache.get(key)!;
  let oh: opening_hours | null = null;
  try {
    oh = new opening_hours(place.openingHours, {
      lat: place.lat,
      lon: place.lng,
      address: { country_code: place.countryCode.toLowerCase(), state: "" },
    });
  } catch {
    oh = null;
  }
  cache.set(key, oh);
  return oh;
}

export function localDate(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

export function openState(place: PlannerPlace, date: string, minutes: number): OpenState {
  if (place.closedDates.includes(date)) return "closed";
  const oh = parser(place);
  if (!oh) return "unknown";
  try {
    return oh.getState(localDate(date, minutes)) ? "open" : "closed";
  } catch {
    return "unknown";
  }
}

/** Is the place open at all on this date (any minute)? */
export function opensOnDate(place: PlannerPlace, date: string): OpenState {
  if (place.closedDates.includes(date)) return "closed";
  const oh = parser(place);
  if (!oh) return "unknown";
  try {
    const from = localDate(date, 0);
    const to = localDate(date, 24 * 60 - 1);
    if (oh.getState(from)) return "open";
    const next = oh.getNextChange(from, to);
    return next ? "open" : "closed";
  } catch {
    return "unknown";
  }
}

/** Minute of the day the place first opens on `date`; null when unknown or closed all day. */
export function opensAt(place: PlannerPlace, date: string): number | null {
  const oh = parser(place);
  if (!oh || place.closedDates.includes(date)) return null;
  try {
    const from = localDate(date, 0);
    if (oh.getState(from)) return 0;
    const next = oh.getNextChange(from, localDate(date, 24 * 60 - 1));
    return next ? next.getHours() * 60 + next.getMinutes() : null;
  } catch {
    return null;
  }
}

/** Minute of the day the place next closes after `fromMinutes` on `date`; null when unknown or not open then. */
export function closesAt(place: PlannerPlace, date: string, fromMinutes: number): number | null {
  const oh = parser(place);
  if (!oh || place.closedDates.includes(date)) return null;
  try {
    const at = localDate(date, fromMinutes);
    if (!oh.getState(at)) return null;
    const next = oh.getNextChange(at, localDate(date, 24 * 60 - 1));
    return next ? next.getHours() * 60 + next.getMinutes() : 24 * 60;
  } catch {
    return null;
  }
}

/**
 * Earliest minute >= `fromMinutes` on `date` at which the place is open for at least
 * `visitMinutes` (approximately: open at start and still open near the end).
 * Returns null when nothing fits before `latestStart`.
 */
export function earliestOpenStart(
  place: PlannerPlace,
  date: string,
  fromMinutes: number,
  visitMinutes: number,
  latestStart: number,
): number | null {
  const oh = parser(place);
  if (!oh || place.closedDates.includes(date)) {
    return place.closedDates.includes(date) ? null : fromMinutes;
  }
  try {
    let t = fromMinutes;
    let guard = 0;
    while (t <= latestStart && guard++ < 12) {
      const d = localDate(date, t);
      if (oh.getState(d)) {
        // Still open a bit before the end of the visit? (allow leaving at closing time)
        const nearEnd = localDate(date, t + Math.max(15, visitMinutes - 30));
        if (oh.getState(nearEnd)) return t;
        const change = oh.getNextChange(nearEnd, localDate(date, latestStart + visitMinutes));
        if (!change) return null;
        t = Math.ceil((change.getHours() * 60 + change.getMinutes()) / 15) * 15;
        continue;
      }
      const next = oh.getNextChange(d, localDate(date, latestStart + 1));
      if (!next) return null;
      t = Math.ceil((next.getHours() * 60 + next.getMinutes()) / 15) * 15;
    }
    return null;
  } catch {
    return fromMinutes;
  }
}

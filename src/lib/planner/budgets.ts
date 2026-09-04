import { effortKmPerDay, type TripPreferences } from "./types";

/** Daily limits derived from who travels and how. Everything in minutes / km. */
export type DayBudget = {
  /** First activity may start (minutes from midnight). */
  dayStart: number;
  /** Last activity must end by. */
  dayEnd: number;
  /** Active minutes (visits + walking) the planner may fill, after the 20% buffer. */
  activeMinutes: number;
  /** Hard cap on walking per day. */
  walkKmMax: number;
  /** Lunch window. */
  lunchStart: number;
  lunchEnd: number;
  lunchMinutes: number;
  /** Insert a rest after this many continuous active minutes (0 = never). */
  restEveryMinutes: number;
  restMinutes: number;
  maxMuseums: number;
  /** Round trip from the base must stay under this (single-base day trips). */
  maxBaseRoundTripMinutes: number;
  /** Arrival / departure days get this share of a full day. */
  halfDayShare: number;
  bufferShare: number;
};

export function hasYoungChildren(prefs: TripPreferences): boolean {
  return prefs.party.infants > 0 || prefs.party.childrenAges.some((a) => a < 8);
}

export function hasChildren(prefs: TripPreferences): boolean {
  return prefs.party.infants > 0 || prefs.party.childrenAges.length > 0;
}

export function computeBudgets(prefs: TripPreferences): DayBudget {
  const kids = hasChildren(prefs);
  const young = hasYoungChildren(prefs);
  const seniors = prefs.party.seniors > 0;
  const mobility = prefs.accessibility.length > 0;

  // Base active hours by effort, then trims for the group.
  let hours = { low: 7, medium: 9, high: 10 }[prefs.effort];
  if (kids) hours -= 1;
  if (young) hours -= 0.5;
  if (seniors) hours -= 1;
  if (mobility) hours -= 0.5;
  hours = Math.max(5, hours);

  const bufferShare = 0.2;
  const grossMinutes = Math.round(hours * 60);

  let walkKmMax = effortKmPerDay[prefs.effort].max;
  if (seniors) walkKmMax = Math.min(walkKmMax, prefs.effort === "high" ? 12 : 8);
  if (young) walkKmMax = Math.min(walkKmMax, 8);
  if (mobility) walkKmMax = Math.min(walkKmMax, 5);
  if (prefs.party.stroller) walkKmMax = Math.min(walkKmMax, 7);

  const dayStart = young || seniors ? 9 * 60 + 30 : 9 * 60;

  return {
    dayStart,
    dayEnd: Math.min(dayStart + grossMinutes + 90, 21 * 60),
    activeMinutes: Math.round(grossMinutes * (1 - bufferShare)),
    walkKmMax,
    lunchStart: 12 * 60 + 15,
    lunchEnd: 14 * 60 + 15,
    lunchMinutes: kids ? 60 : 50,
    restEveryMinutes: young ? 120 : kids || seniors ? 150 : 0,
    restMinutes: young ? 30 : 20,
    maxMuseums: kids ? 2 : 3,
    maxBaseRoundTripMinutes: kids ? 120 : 180,
    halfDayShare: 0.5,
    bufferShare,
  };
}

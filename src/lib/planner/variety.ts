import { swapDayContent, type DayPlan } from "./assign";

/** A day is physically heavy when it is a day trip or uses most of the walking budget. */
export function isHeavy(day: DayPlan, walkKmMax: number): boolean {
  return day.isDayTrip || (walkKmMax > 0 && day.plannedWalkKm / walkKmMax >= 0.7);
}

function sameTheme(a: DayPlan, b: DayPlan): boolean {
  return a.theme !== null && a.theme === b.theme;
}

/**
 * No two heavy days in a row, no two days with the same theme in a row.
 * Only full days inside the same stay are swapped; arrival, departure and transfer days stay put.
 */
export function reorderForVariety(days: DayPlan[], walkKmMax: number): DayPlan[] {
  const out = days.map((d) => ({ ...d }));
  const heavy = (d: DayPlan) => isHeavy(d, walkKmMax);
  const movable = (d: DayPlan) => d.kind === "full" && !d.isTransfer;
  const conflicts = (a: DayPlan, b: DayPlan) => (heavy(a) && heavy(b)) || sameTheme(a, b);

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1];
      const cur = out[i];
      if (!conflicts(prev, cur) || !movable(cur)) continue;
      for (let j = i + 1; j < out.length; j++) {
        const cand = out[j];
        if (cand.stayId !== cur.stayId || !movable(cand)) continue;
        // Would swapping i and j resolve here without creating a conflict there?
        const okHere = !conflicts(prev, cand) && (j === i + 1 || !conflicts(cand, out[i + 1]));
        const beforeJ = j === i + 1 ? cand : out[j - 1];
        const afterJ = out[j + 1];
        const okThere = !conflicts(beforeJ, cur) && (!afterJ || !conflicts(cur, afterJ));
        if (okHere && okThere) {
          swapDayContent(out, i, j);
          changed = true;
          break;
        }
      }
    }
  }
  return out;
}

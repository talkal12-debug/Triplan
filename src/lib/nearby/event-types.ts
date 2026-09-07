import type { EventType } from "@/lib/planner/types";
import type { EventItem } from "./schema";

/**
 * Kinds of ticketed events the traveller can ask for (interests step), matched
 * against the seller's own classification (Ticketmaster: segment > genre >
 * sub-genre names). Matching is by keyword because that taxonomy is large and
 * changes; an event whose classification matches nothing is kept, just not
 * marked as preferred. Client-safe, no I/O.
 */
export type Classification = { segment?: string | null; genre?: string | null; subGenre?: string | null };

const musical = /musical/i;
const comedy = /comed|stand-?up/i;
const classical = /classical|opera|symphon|orchestra|chamber|philharmon/i;
const theatre = /theat|drama|\bplays?\b/i;
const dance = /dance|ballet/i;
const family = /family|children|kids|circus|magic|puppet/i;

export function eventMatches(type: EventType, c: Classification): boolean {
  const segment = (c.segment ?? "").toLowerCase();
  const text = `${c.genre ?? ""}|${c.subGenre ?? ""}`;
  switch (type) {
    case "concert":
      return segment === "music" && !classical.test(text);
    case "sports":
      return segment === "sports";
    case "musical":
      return musical.test(text);
    case "theatre":
      return theatre.test(text) && !musical.test(text) && !comedy.test(text);
    case "comedy":
      return comedy.test(text);
    case "classical":
      return classical.test(text);
    case "dance":
      return dance.test(text);
    case "family":
      return family.test(text);
  }
}

/** Ticketmaster `classificationName` values that pull in each kind (the API matches any segment, genre or sub-genre name). */
export const classificationNames: Record<EventType, string[]> = {
  concert: ["Music"],
  musical: ["Musical"],
  theatre: ["Theatre"],
  comedy: ["Comedy"],
  classical: ["Classical", "Opera"],
  dance: ["Dance"],
  sports: ["Sports"],
  family: ["Family", "Children"],
};

export function classificationNamesFor(types: readonly EventType[]): string[] {
  return [...new Set(types.flatMap((t) => classificationNames[t]))];
}

/** Preferred kinds first (order kept within each group), each preferred event flagged; no preference leaves the list as it is. */
export function rankEvents<T extends EventItem>(events: T[], types: readonly EventType[]): T[] {
  if (types.length === 0) return events;
  return events
    .map((e) => ({ ...e, preferred: types.some((t) => eventMatches(t, e)) }))
    .sort((a, b) => Number(b.preferred) - Number(a.preferred));
}

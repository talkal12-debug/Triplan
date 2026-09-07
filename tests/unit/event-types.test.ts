import { describe, expect, it } from "vitest";
import { classificationNamesFor, eventMatches, rankEvents } from "@/lib/nearby/event-types";
import type { EventItem } from "@/lib/nearby/schema";

const ev = (id: string, segment: string | null, genre: string | null, subGenre: string | null = null): EventItem => ({
  id,
  name: id,
  url: "https://www.ticketmaster.com/event/" + id,
  start: "2026-10-03T20:00",
  venue: null,
  category: genre ?? segment,
  source: "ticketmaster",
  segment,
  genre,
  subGenre,
});

describe("event kinds (evening preference)", () => {
  it("matches Ticketmaster classifications by keyword", () => {
    expect(eventMatches("comedy", { segment: "Arts & Theatre", genre: "Comedy" })).toBe(true);
    expect(eventMatches("musical", { segment: "Arts & Theatre", genre: "Theatre", subGenre: "Musical" })).toBe(true);
    // A musical is not "theatre" in the plain sense the traveller asked for, nor is comedy.
    expect(eventMatches("theatre", { segment: "Arts & Theatre", genre: "Theatre", subGenre: "Musical" })).toBe(false);
    expect(eventMatches("theatre", { segment: "Arts & Theatre", genre: "Theatre", subGenre: "Drama" })).toBe(true);
    expect(eventMatches("concert", { segment: "Music", genre: "Rock" })).toBe(true);
    expect(eventMatches("concert", { segment: "Music", genre: "Classical" })).toBe(false);
    expect(eventMatches("classical", { segment: "Music", genre: "Classical", subGenre: "Symphony" })).toBe(true);
    expect(eventMatches("classical", { segment: "Arts & Theatre", genre: "Opera" })).toBe(true);
    expect(eventMatches("sports", { segment: "Sports", genre: "Football" })).toBe(true);
    expect(eventMatches("dance", { segment: "Arts & Theatre", genre: "Dance", subGenre: "Ballet" })).toBe(true);
    expect(eventMatches("family", { segment: "Arts & Theatre", genre: "Children's Theatre" })).toBe(true);
    expect(eventMatches("family", { segment: "Music", genre: "Rock" })).toBe(false);
    // Unknown classification: matches nothing, is not an error.
    expect(eventMatches("comedy", { segment: null, genre: null })).toBe(false);
  });

  it("puts preferred kinds first, keeps the rest, keeps order inside each group", () => {
    const list = [ev("rock", "Music", "Rock"), ev("standup", "Arts & Theatre", "Comedy"), ev("derby", "Sports", "Football"), ev("opera", "Arts & Theatre", "Opera")];
    const ranked = rankEvents(list, ["comedy", "sports"]);
    expect(ranked.map((e) => e.id)).toEqual(["standup", "derby", "rock", "opera"]);
    expect(ranked.map((e) => e.preferred)).toEqual([true, true, false, false]);
  });

  it("leaves the list untouched without a preference", () => {
    const list = [ev("a", "Music", "Rock"), ev("b", "Sports", "Football")];
    expect(rankEvents(list, [])).toBe(list);
  });

  it("turns kinds into distinct Ticketmaster classification names", () => {
    expect(classificationNamesFor(["classical", "concert", "classical"])).toEqual(["Classical", "Opera", "Music"]);
  });
});

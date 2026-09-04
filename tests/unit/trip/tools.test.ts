import { describe, expect, it } from "vitest";
import { generateItinerary } from "@/lib/planner";
import { buildIcs, icsEscape } from "@/lib/export/ics";
import { buildGpx, buildKml, xmlEscape } from "@/lib/export/geo";
import { estimateBudget } from "@/lib/trip/budget";
import { buildPackingList } from "@/lib/trip/packing";
import { buildChecklist } from "@/lib/trip/checklist";
import type { GuestPlan } from "@/lib/guest/trips";
import { loadMany, prefsFor } from "../planner/helpers";

const data = loadMany(["PT"]);
const prefs = prefsFor({
  destinations: [{ countryCode: "PT", cities: ["lisbon"] }],
  dates: { start: "2026-10-16", days: 4, arrivalTime: null, departureTime: null },
  party: { adults: 2, childrenAges: [6], infants: 1, stroller: true, seniors: 0 },
  transport: { walk: 3, bike: 0, car: 2, transit: 1, tours: 0 },
});
const { itinerary } = generateItinerary({ prefs, places: data.places, cities: data.cities });
const plan: GuestPlan = {
  itinerary,
  places: Object.fromEntries(data.places.map((p) => [p.id, p])),
  cities: data.cities,
  unused: [],
  extras: {
    weather: { "2026-10-16": { date: "2026-10-16", precipProbability: 70, precipMm: 6, tempMax: 22, tempMin: 14, code: null, kind: "normals" } },
    weatherSource: "test",
    holidays: [{ date: "2026-10-17", name: "Test", localName: "Feriado", countryCode: "PT" }],
    rates: { base: "EUR", date: "2026-09-03", rates: { ILS: 3.5 }, source: "test" },
    links: { hotels: [], tickets: {}, flights: [] },
    providers: {},
    notes: [],
  },
};
const opts = { title: "Lisbon trip", placeName: (id: string) => plan.places[id]?.names.en ?? id, kindLabel: (k: string) => k, dayLabel: (i: number) => `Day ${i + 1}` };

describe("exports", () => {
  it("builds a valid-looking ICS with one event per activity and escaped text", () => {
    const ics = buildIcs(plan, opts);
    const events = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
    expect(events).toBe(itinerary.days.reduce((n, d) => n + d.activities.length, 0));
    expect(ics).toContain("DTSTART:20261016T");
    expect(ics).toMatch(/GEO:38\.\d+;-9\.\d+/);
    expect(icsEscape("a, b; c\nd")).toBe("a\\, b\\; c\\nd");
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });

  it("builds GPX and KML with a waypoint per stop and a track per day", () => {
    const visits = itinerary.days.reduce((n, d) => n + d.activities.filter((a) => a.kind === "visit").length, 0);
    const gpx = buildGpx(plan, opts);
    expect((gpx.match(/<wpt /g) ?? []).length).toBe(visits);
    expect((gpx.match(/<trk>/g) ?? []).length).toBe(itinerary.days.filter((d) => d.activities.some((a) => a.kind === "visit")).length);
    const kml = buildKml(plan, opts);
    expect((kml.match(/<Point>/g) ?? []).length).toBe(visits);
    expect(kml).toContain("<LineString>");
    expect(xmlEscape('Tom & Jerry <"x">')).toBe("Tom &amp; Jerry &lt;&quot;x&quot;&gt;");
  });
});

describe("budget", () => {
  it("estimates per person per day in the traveller's currency and scales with the country", () => {
    const b = estimateBudget(prefs, itinerary, plan.places, { quote: "ILS", value: 3.5 });
    expect(b.currency).toBe("ILS");
    expect(b.lines.map((l) => l.key)).toEqual(["lodging", "tickets", "transport", "food"]);
    expect(b.groupTotal).toBeGreaterThan(0);
    expect(b.perPersonPerDay).toBeGreaterThan(100);
    expect(b.nights).toBe(3);
    const eur = estimateBudget(prefs, itinerary, plan.places, null);
    expect(eur.currency).toBe("EUR");
    expect(eur.groupTotal).toBeLessThan(b.groupTotal);
    const ch = estimateBudget({ ...prefs, destinations: [{ countryCode: "CH", cities: [] }] }, itinerary, plan.places, null);
    expect(ch.groupTotal).toBeGreaterThan(eur.groupTotal);
  });

  it("compares with the daily cap when one is set", () => {
    const capped = estimateBudget({ ...prefs, budget: { ...prefs.budget, dailyCap: 300 } }, itinerary, plan.places, { quote: "ILS", value: 3.5 });
    expect(capped.capRatio).not.toBeNull();
  });
});

describe("packing list", () => {
  it("reacts to weather, kids, car and plugs", () => {
    const items = buildPackingList({ prefs, weather: plan.extras?.weather, plugTypes: ["C", "F"] });
    const ids = items.map((i) => i.id);
    expect(ids).toContain("rain_jacket");
    expect(ids).toContain("diapers");
    expect(ids).toContain("stroller_travel");
    expect(ids).toContain("driving_licence");
    expect(ids).not.toContain("plug_adapter"); // type C works with Israeli plugs
    const jp = buildPackingList({ prefs, plugTypes: ["A", "B"] });
    expect(jp.find((i) => i.id === "plug_adapter")?.note).toBe("A / B");
    expect(jp.map((i) => i.id)).toContain("check_weather");
  });
});

describe("checklist", () => {
  it("adds due dates, advance bookings and holiday alerts, sorted by date", () => {
    const list = buildChecklist(prefs, plan, opts.placeName);
    const ids = list.map((i) => i.id);
    expect(ids).toContain("passport_validity");
    expect(ids).toContain("car_rental");
    expect(ids).toContain("kids_documents");
    expect(ids).toContain("holiday");
    expect(list.find((i) => i.id === "passport_validity")?.params?.until).toBe("2027-04-20");
    for (let i = 1; i < list.length; i++) expect(list[i - 1].due <= list[i].due).toBe(true);
    const booking = list.filter((i) => i.id === "book_place");
    expect(booking.length).toBe(new Set(itinerary.days.flatMap((d) => d.activities).filter((a) => a.placeId && plan.places[a.placeId]?.requiresAdvanceBooking).map((a) => a.placeId)).size);
  });
});

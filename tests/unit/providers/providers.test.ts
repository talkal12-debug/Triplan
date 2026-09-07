import { afterEach, describe, expect, it, vi } from "vitest";
import { affiliateIdsFromEnv, carLinks, flightLinks, hotelLinks, ticketLinks } from "@/lib/providers/affiliate";
import { classify, enrichWithWikidata, iconicityFromSitelinks, slugify, toPlace, type WikidataFacts } from "@/lib/providers/pois/osm";
import { osrmRouting } from "@/lib/providers/routing/osrm";
import { estimateRouting } from "@/lib/providers/routing/estimate";
import { openMeteo } from "@/lib/providers/weather/open-meteo";
import { nagerDate } from "@/lib/providers/holidays/nager";
import { mockHolidays } from "@/lib/providers/holidays/mock";
import { frankfurter } from "@/lib/providers/currency/frankfurter";
import { mockCurrency } from "@/lib/providers/currency/mock";
import { clearProviderCache } from "@/lib/providers/http";

vi.mock("server-only", () => ({}));

function mockFetch(body: unknown, status = 200) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const fn = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearProviderCache();
});

describe("affiliate links", () => {
  const q = { city: "Lisbon", countryName: "Portugal", checkIn: "2026-10-16", checkOut: "2026-10-20", adults: 2, childrenAges: [5], type: "hostel" };

  it("builds plain hotel links without ids and marks them as non-affiliate", () => {
    const links = hotelLinks(q);
    expect(links.map((l) => l.provider)).toEqual(["hostelworld", "booking", "hotelscom", "agoda"]);
    expect(links.every((l) => !l.affiliate)).toBe(true);
    const booking = links.find((l) => l.provider === "booking")!;
    expect(booking.url).toContain("checkin=2026-10-16");
    expect(booking.url).toContain("group_children=1");
    expect(booking.url).toContain("age=5");
    expect(booking.url).not.toContain("aid=");
  });

  it("applies affiliate ids from the environment", () => {
    const ids = affiliateIdsFromEnv({ AFFILIATE_BOOKING_AID: "12345", AFFILIATE_GETYOURGUIDE_PARTNER_ID: "TRIP" } as unknown as NodeJS.ProcessEnv);
    const booking = hotelLinks(q, ids).find((l) => l.provider === "booking")!;
    expect(booking.affiliate).toBe(true);
    expect(booking.url).toContain("aid=12345");
    const gyg = ticketLinks({ placeName: "Belém Tower", city: "Lisbon", date: "2026-10-17" }, ids)[0];
    expect(gyg.provider).toBe("getyourguide");
    expect(gyg.url).toContain("partner_id=TRIP");
    expect(gyg.url).toContain("Bel%C3%A9m%20Tower%20Lisbon");
  });

  it("builds flight links from the traveller's city with dates and passengers", () => {
    const [kiwi, skyscanner, google, kayak, momondo, tripcom] = flightLinks({ originCity: "Tel Aviv", originIata: "TLV", destinationCity: "Tokyo", destinationCountryName: "Japan", destinationIata: "HND", departDate: "2026-10-16", returnDate: "2026-10-23", adults: 2, children: 1 });
    expect(kiwi.url).toContain("/tel-aviv/tokyo-japan/2026-10-16/2026-10-23");
    expect(kiwi.url).toContain("children=1");
    expect(skyscanner.url).toContain("/tlv/hnd/261016/261023/");
    expect(google.url).toContain("Flights%20from%20TLV%20to%20HND%20on%202026-10-16%20through%202026-10-23");
    expect(kayak.url).toBe("https://www.kayak.com/flights/TLV-TYO/2026-10-16/2026-10-23/2adults?sort=bestflight_a");
    expect(momondo.url).toBe("https://www.momondo.com/flight-search/TLV-TYO/2026-10-16/2026-10-23/2adults?sort=bestflight_a");
    // Trip.com wants the city code: Haneda is "Tokyo" (TYO), Ben Gurion is its own city code.
    expect(tripcom.url).toContain("dcity=tlv&acity=tyo&ddate=2026-10-16&rdate=2026-10-23");
    // Skyscanner needs airport codes: without them only Kiwi (which understands names) is offered.
    const noCodes = flightLinks({ originCity: "", destinationCity: "Tokyo", departDate: "2026-10-16", returnDate: "2026-10-23", adults: 1, children: 0 });
    expect(noCodes.map((l) => l.provider)).toEqual(["kiwi", "googleflights"]);
    expect(noCodes[1].url).toContain("q=Flights%20to%20Tokyo%20on%202026-10-16");
    expect(noCodes[0].url).toContain("/anywhere/tokyo/");
  });

  it("builds car rental links for the trip dates and applies raw tracking queries", () => {
    const [rentalcars, discover] = carLinks({ pickUpCity: "Rome", dropOffCity: "Rome", countryName: "Italy", pickUpDate: "2026-10-16", dropOffDate: "2026-10-20" }, { query: { discovercars: "a_aid=triplan" } });
    expect(rentalcars.url).toContain("location=Rome%2C%20Italy");
    expect(rentalcars.url).toContain("puYear=2026");
    expect(rentalcars.affiliate).toBe(false);
    expect(discover.url).toContain("/italy/rome?pickupDate=2026-10-16");
    expect(discover.url).toContain("&a_aid=triplan");
    expect(discover.affiliate).toBe(true);
  });

  it("reads raw tracking queries from AFFILIATE_QUERY_<PROVIDER>", () => {
    const ids = affiliateIdsFromEnv({ AFFILIATE_QUERY_AGODA: "cid=777", AFFILIATE_BOOKING_AID: "1" } as unknown as NodeJS.ProcessEnv);
    expect(ids.query?.agoda).toBe("cid=777");
    const agoda = hotelLinks({ city: "Tokyo", countryCode: "JP", checkIn: "2026-10-16", checkOut: "2026-10-20", adults: 2, childrenAges: [] }, ids).find((l) => l.provider === "agoda");
    expect(agoda?.url).toContain("agoda.com/city/tokyo-jp.html?checkIn=2026-10-16");
    expect(agoda?.url).toContain("&cid=777");
    expect(agoda?.affiliate).toBe(true);
  });
});

describe("OpenStreetMap mapping", () => {
  const city = { slug: "osm-paris-71525", countryCode: "FR", names: { en: "Paris", local: "Paris" }, center: { lat: 48.85, lng: 2.35 }, bbox: [48.8, 2.2, 48.9, 2.5] as [number, number, number, number] };

  it("classifies OSM tags into Triplan categories", () => {
    expect(classify({ tourism: "museum" })?.category).toBe("museum");
    expect(classify({ amenity: "place_of_worship", religion: "jewish" })?.tags).toContain("jewish");
    expect(classify({ amenity: "place_of_worship", religion: "shinto" })?.category).toBe("shrine");
    expect(classify({ leisure: "park" })?.kidFriendly).toBe(true);
    expect(classify({ shop: "bakery" })).toBeNull();
  });

  it("turns an Overpass element into a place, verified only when hours exist", () => {
    const withHours = toPlace({ type: "way", id: 1, center: { lat: 48.86, lon: 2.33 }, tags: { name: "Musée du Louvre", "name:en": "Louvre Museum", "name:he": "מוזיאון הלובר", tourism: "museum", opening_hours: "Mo-Su 09:00-18:00", wikidata: "Q19675", wikipedia: "fr:Louvre", wheelchair: "yes", website: "louvre.fr" } }, city);
    expect(withHours?.dataQuality).toBe("verified");
    expect(withHours?.names.he).toBe("מוזיאון הלובר");
    expect(withHours?.iconicity).toBe(0.7);
    expect(withHours?.website).toBe("https://louvre.fr/");
    expect(withHours?.id).toBe("fr-osm-paris-71525-musee-du-louvre-1");
    const noHours = toPlace({ type: "node", id: 2, lat: 48.86, lon: 2.34, tags: { name: "Petit parc", leisure: "park" } }, city);
    expect(noHours?.dataQuality).toBe("partial");
    expect(noHours?.iconicity).toBe(0.3);
    expect(toPlace({ type: "node", id: 3, lat: 1, lon: 1, tags: { tourism: "museum" } }, city)).toBeNull(); // no name
  });

  it("ranks by Wikipedia notability and fills Hebrew names from Wikidata", () => {
    expect(iconicityFromSitelinks(0)).toBe(0.3);
    expect(iconicityFromSitelinks(40)).toBeCloseTo(0.86, 1);
    expect(iconicityFromSitelinks(190)).toBe(1);
    const louvre = toPlace({ type: "way", id: 1, center: { lat: 48.86, lon: 2.33 }, tags: { name: "Musée du Louvre", tourism: "museum", wikidata: "Q19675" } }, city)!;
    const plaque = toPlace({ type: "node", id: 2, lat: 48.86, lon: 2.34, tags: { name: "Monument à X", historic: "monument", wikidata: "Q1" } }, city)!;
    const [a, b] = enrichWithWikidata([louvre, plaque], new Map<string, WikidataFacts>([["Q19675", { sitelinks: 169, labels: { he: "מוזיאון הלובר", en: "Louvre Museum" } }], ["Q1", { sitelinks: 2, labels: {} }]]));
    expect(a.iconicity).toBe(1);
    expect(a.names.he).toBe("מוזיאון הלובר");
    expect(b.iconicity).toBeLessThan(0.5);
    expect(classify({ historic: "memorial", name: "Plaque" })).toBeNull();
  });

  it("slugifies accented names", () => {
    expect(slugify("Château de Versailles")).toBe("chateau-de-versailles");
    expect(slugify("東京")).toBe("");
  });
});

describe("routing", () => {
  const points = [
    { lat: 38.7077, lng: -9.1366 },
    { lat: 38.7139, lng: -9.1334 },
  ];

  it("estimate provider is always available", async () => {
    const m = await estimateRouting.matrix(points, "walk");
    expect(m.estimated).toBe(true);
    expect(m.minutes[0][1]).toBeGreaterThan(5);
    expect(m.minutes[0][0]).toBe(0);
  });

  it("OSRM table response becomes a real matrix with parking overhead for cars", async () => {
    const fetch = mockFetch({ code: "Ok", durations: [[0, 600], [660, 0]], distances: [[0, 800], [850, 0]] });
    const m = await osrmRouting("https://example.test/{profile}").matrix(points, "car");
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0][0])).toContain("/car/table/v1/driving/");
    expect(m.estimated).toBe(false);
    expect(m.minutes[0][1]).toBe(10 + 8);
    expect(m.meters[1][0]).toBe(850);
  });

  it("falls back to estimates for transit and on errors", async () => {
    const fetch = mockFetch({}, 500);
    const transit = await osrmRouting("https://example.test/{profile}").matrix(points, "transit");
    expect(transit.estimated).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    await expect(osrmRouting("https://example.test/{profile}").matrix(points, "walk")).rejects.toThrow(/HTTP 500/);
  });
});

describe("weather, holidays, currency", () => {
  it("labels far-future weather as last year's normals with a capped rain probability", async () => {
    mockFetch({ daily: { time: ["2025-10-16", "2025-10-17"], precipitation_sum: [8, 0], temperature_2m_max: [21, 22], temperature_2m_min: [14, 13] } });
    const r = await openMeteo.daily({ lat: 38.7, lng: -9.1 }, "2026-10-16", 2);
    expect(r.kind).toBe("normals");
    expect(r.days[0]).toMatchObject({ date: "2026-10-16", precipProbability: 60, tempMax: 21 });
    expect(r.days[1].precipProbability).toBe(10);
  });

  it("uses the forecast for the next two weeks", async () => {
    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const fetch = mockFetch({ daily: { time: [start], precipitation_probability_max: [30], precipitation_sum: [0.4], temperature_2m_max: [25], temperature_2m_min: [17], weather_code: [2] } });
    const r = await openMeteo.daily({ lat: 38.7, lng: -9.1 }, start, 1);
    expect(r.kind).toBe("forecast");
    expect(String(fetch.mock.calls[0][0])).toContain("api.open-meteo.com/v1/forecast");
    expect(r.days[0].code).toBe(2);
  });

  it("filters Nager.Date to public holidays and keeps local names", async () => {
    mockFetch([
      { date: "2026-04-25", localName: "Dia da Liberdade", name: "Freedom Day", countryCode: "PT", global: true, types: ["Public"] },
      { date: "2026-06-13", localName: "Santo António", name: "St. Anthony", countryCode: "PT", global: false, types: ["Optional"] },
    ]);
    const list = await nagerDate.holidays("PT", 2026);
    expect(list).toEqual([{ date: "2026-04-25", name: "Freedom Day", localName: "Dia da Liberdade", countryCode: "PT" }]);
    expect((await mockHolidays.holidays("JP", 2026)).some((h) => h.date === "2026-05-05")).toBe(true);
  });

  it("returns ECB rates and a rough offline fallback", async () => {
    mockFetch({ amount: 1, base: "EUR", date: "2026-09-03", rates: { ILS: 3.5069 } });
    const r = await frankfurter.rates("EUR", ["ILS"]);
    expect(r.rates.ILS).toBeCloseTo(3.5069);
    const m = await mockCurrency.rates("EUR", ["ILS", "XXX"]);
    expect(m.rates.ILS).toBeCloseTo(3.5, 1);
    expect(m.rates.XXX).toBeUndefined();
    expect(m.source).toBe("demo");
  });
});

import { z } from "zod";
import { metroCode } from "@/lib/data/metro-codes";

/**
 * Every outbound booking link is built here and only here, so affiliate ids,
 * disclosure labelling and rel="sponsored" are applied consistently.
 * Without affiliate ids the links are plain search links (the disclosure page says so).
 *
 * Every link is a deep link into the partner's search for the trip's city, dates
 * and party, so the traveller lands on results and not on a home page.
 */

export const affiliateProviders = [
  "booking",
  "hotelscom",
  "agoda",
  "hostelworld",
  "getyourguide",
  "viator",
  "tiqets",
  "klook",
  "kiwi",
  "skyscanner",
  "googleflights",
  "kayak",
  "momondo",
  "tripcom",
  "rentalcars",
  "discovercars",
  "ticketmaster",
  "eventbrite",
  "songkick",
  "residentadvisor",
] as const;
export type AffiliateProvider = (typeof affiliateProviders)[number];

export const affiliateLinkSchema = z.object({
  provider: z.enum(affiliateProviders),
  kind: z.enum(["hotel", "ticket", "flight", "car", "event"]),
  url: z.string().url(),
  /** true when an affiliate id was applied */
  affiliate: z.boolean(),
});
export type AffiliateLink = z.infer<typeof affiliateLinkSchema>;

/**
 * Tracking parameters per partner. The well-known ones have their own field;
 * `query` holds any partner's extra tracking query string verbatim (what the
 * partner dashboard's link generator prints, e.g. "cid=123&tag=triplan"), for
 * programs whose parameters differ per network (Impact, Travelpayouts, ...).
 */
export type AffiliateIds = {
  bookingAid?: string;
  getYourGuidePartnerId?: string;
  viatorPid?: string;
  tiqetsPartner?: string;
  klookAid?: string;
  kiwiAffilId?: string;
  query?: Partial<Record<AffiliateProvider, string>>;
};

export type HotelQuery = {
  city: string;
  countryName?: string;
  /** ISO 3166-1 alpha-2, for partners whose URLs are keyed by country (Agoda city pages). */
  countryCode?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  type?: string;
};

export type TicketQuery = {
  placeName: string;
  city: string;
  date: string;
};

export type FlightQuery = {
  /** Where the traveller flies from (city name); empty = let the site ask */
  originCity: string;
  destinationCity: string;
  destinationCountryName?: string;
  /** Airport codes, when known (see src/lib/data/airports.ts). Skyscanner only works with codes. */
  originIata?: string | null;
  destinationIata?: string | null;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
};

export type CarQuery = {
  pickUpCity: string;
  dropOffCity: string;
  countryName?: string;
  pickUpDate: string;
  dropOffDate: string;
  /** Driver age matters for most rental sites; adults' default is fine. */
  driverAge?: number;
};

const enc = encodeURIComponent;
const compact = (s: string) => s.trim().replace(/\s+/g, " ");
/** "Tel Aviv" -> "tel-aviv" (Kiwi / Discover Cars style path segments). */
const slug = (s: string) =>
  compact(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Appends the partner's tracking query (if configured) and reports whether it did. */
function withTracking(url: string, provider: AffiliateProvider, ids: AffiliateIds, known?: string): { url: string; affiliate: boolean } {
  const extra = ids.query?.[provider]?.replace(/^[?&]/, "");
  if (!known && !extra) return { url, affiliate: false };
  const sep = url.includes("?") ? "&" : "?";
  return { url: `${url}${known ? `${sep}${known}` : ""}${extra ? `${known ? "&" : sep}${extra}` : ""}`, affiliate: true };
}

export function hotelLinks(q: HotelQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const dest = compact(q.countryName ? `${q.city}, ${q.countryName}` : q.city);
  const ages = q.childrenAges.map((a) => `&age=${a}`).join("");
  const booking = withTracking(
    `https://www.booking.com/searchresults.html?ss=${enc(dest)}&checkin=${q.checkIn}&checkout=${q.checkOut}&group_adults=${q.adults}&group_children=${q.childrenAges.length}${ages}&no_rooms=1`,
    "booking",
    ids,
    ids.bookingAid ? `aid=${enc(ids.bookingAid)}` : undefined,
  );
  const hotelscom = withTracking(
    `https://www.hotels.com/Hotel-Search?destination=${enc(dest)}&startDate=${q.checkIn}&endDate=${q.checkOut}&adults=${q.adults}${q.childrenAges.length ? `&children=${q.childrenAges.map((a) => `1_${a}`).join(",")}` : ""}`,
    "hotelscom",
    ids,
  );
  // Agoda's text search redirects to its home page; its city pages (city/<name>-<cc>.html) take the dates.
  const agodaPath = q.countryCode ? `city/${slug(q.city)}-${q.countryCode.toLowerCase()}.html` : "search";
  const agoda = withTracking(
    `https://www.agoda.com/${agodaPath}?checkIn=${q.checkIn}&checkOut=${q.checkOut}&adults=${q.adults}&children=${q.childrenAges.length}&rooms=1`,
    "agoda",
    ids,
  );
  const links: AffiliateLink[] = [
    { provider: "booking", kind: "hotel", ...booking },
    { provider: "hotelscom", kind: "hotel", ...hotelscom },
    { provider: "agoda", kind: "hotel", ...agoda },
  ];
  if (q.type === "hostel" || q.type === "camping") {
    const hostelworld = withTracking(
      `https://www.hostelworld.com/search?search_keywords=${enc(dest)}&date_from=${q.checkIn}&date_to=${q.checkOut}&number_of_guests=${q.adults + q.childrenAges.length}`,
      "hostelworld",
      ids,
    );
    links.unshift({ provider: "hostelworld", kind: "hotel", ...hostelworld });
  }
  return links;
}

export function ticketLinks(q: TicketQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const query = compact(`${q.placeName} ${q.city}`);
  const gyg = withTracking(
    `https://www.getyourguide.com/s/?q=${enc(query)}&date_from=${q.date}&date_to=${q.date}`,
    "getyourguide",
    ids,
    ids.getYourGuidePartnerId ? `partner_id=${enc(ids.getYourGuidePartnerId)}` : undefined,
  );
  const tiqets = withTracking(`https://www.tiqets.com/en/search?q=${enc(query)}`, "tiqets", ids, ids.tiqetsPartner ? `partner=${enc(ids.tiqetsPartner)}` : undefined);
  const viator = withTracking(`https://www.viator.com/searchResults/all?text=${enc(query)}`, "viator", ids, ids.viatorPid ? `pid=${enc(ids.viatorPid)}&mcid=42383&medium=link` : undefined);
  const klook = withTracking(`https://www.klook.com/search/?query=${enc(query)}`, "klook", ids, ids.klookAid ? `aid=${enc(ids.klookAid)}` : undefined);
  return [
    { provider: "getyourguide", kind: "ticket", ...gyg },
    { provider: "tiqets", kind: "ticket", ...tiqets },
    { provider: "viator", kind: "ticket", ...viator },
    { provider: "klook", kind: "ticket", ...klook },
  ];
}

export function flightLinks(q: FlightQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const from = q.originCity ? slug(q.originCity) : "anywhere";
  const to = slug(q.destinationCountryName ? `${q.destinationCity} ${q.destinationCountryName}` : q.destinationCity);
  const kiwi = withTracking(
    `https://www.kiwi.com/en/search/results/${from}/${to}/${q.departDate}/${q.returnDate}?adults=${q.adults}&children=${q.children}`,
    "kiwi",
    ids,
    ids.kiwiAffilId ? `affilid=${enc(ids.kiwiAffilId)}` : undefined,
  );
  const links: AffiliateLink[] = [{ provider: "kiwi", kind: "flight", ...kiwi }];
  // Skyscanner's URL form is /flights/<origin code>/<destination code>/<yymmdd>/<yymmdd>/ and answers 404 to names.
  if (q.originIata && q.destinationIata) {
    const yymmdd = (d: string) => d.slice(2).replaceAll("-", "");
    const skyscanner = withTracking(
      `https://www.skyscanner.net/transport/flights/${q.originIata.toLowerCase()}/${q.destinationIata.toLowerCase()}/${yymmdd(q.departDate)}/${yymmdd(q.returnDate)}/?adults=${q.adults}&children=${q.children}&rtn=1`,
      "skyscanner",
      ids,
    );
    links.push({ provider: "skyscanner", kind: "flight", ...skyscanner });
  }
  // Google Flights takes a sentence; codes when we have them, else the city names. No affiliate program.
  const google = withTracking(
    `https://www.google.com/travel/flights?q=${enc(`Flights ${q.originIata || q.originCity ? `from ${q.originIata || q.originCity} ` : ""}to ${q.destinationIata ?? q.destinationCity} on ${q.departDate} through ${q.returnDate}`)}`,
    "googleflights",
    ids,
  );
  links.push({ provider: "googleflights", kind: "flight", ...google });
  if (q.originIata && q.destinationIata) {
    // Kayak and Momondo share one URL form (/ORIG-DEST/date/date/<n>adults) and take city codes, so every
    // airport of the city is searched; children are added on the site.
    const pair = `${metroCode(q.originIata)}-${metroCode(q.destinationIata)}`;
    const kayak = withTracking(`https://www.kayak.com/flights/${pair}/${q.departDate}/${q.returnDate}/${q.adults}adults?sort=bestflight_a`, "kayak", ids);
    const momondo = withTracking(`https://www.momondo.com/flight-search/${pair}/${q.departDate}/${q.returnDate}/${q.adults}adults?sort=bestflight_a`, "momondo", ids);
    // Trip.com searches by city code (LON, not LHR) and, in English, lowercase.
    const tripcom = withTracking(
      `https://www.trip.com/flights/showfarefirst?dcity=${metroCode(q.originIata).toLowerCase()}&acity=${metroCode(q.destinationIata).toLowerCase()}&ddate=${q.departDate}&rdate=${q.returnDate}&triptype=rt&class=y&quantity=${q.adults}`,
      "tripcom",
      ids,
    );
    links.push({ provider: "kayak", kind: "flight", ...kayak }, { provider: "momondo", kind: "flight", ...momondo }, { provider: "tripcom", kind: "flight", ...tripcom });
  }
  return links;
}

export function carLinks(q: CarQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const pick = compact(q.countryName ? `${q.pickUpCity}, ${q.countryName}` : q.pickUpCity);
  const drop = compact(q.countryName ? `${q.dropOffCity}, ${q.countryName}` : q.dropOffCity);
  const age = q.driverAge ?? 35;
  const rentalcars = withTracking(
    `https://www.rentalcars.com/search-results?location=${enc(pick)}&dropLocation=${enc(drop)}&puDay=${Number(q.pickUpDate.slice(8))}&puMonth=${Number(q.pickUpDate.slice(5, 7))}&puYear=${q.pickUpDate.slice(0, 4)}&puHour=10&puMinute=0&doDay=${Number(q.dropOffDate.slice(8))}&doMonth=${Number(q.dropOffDate.slice(5, 7))}&doYear=${q.dropOffDate.slice(0, 4)}&doHour=10&doMinute=0&driversAge=${age}`,
    "rentalcars",
    ids,
  );
  const discover = withTracking(
    `https://www.discovercars.com/${q.countryName ? `${slug(q.countryName)}/` : ""}${slug(q.pickUpCity)}?pickupDate=${q.pickUpDate}&pickupTime=10:00&dropoffDate=${q.dropOffDate}&dropoffTime=10:00&driverAge=${age}`,
    "discovercars",
    ids,
  );
  return [
    { provider: "rentalcars", kind: "car", ...rentalcars },
    { provider: "discovercars", kind: "car", ...discover },
  ];
}

/**
 * Read affiliate ids from the environment (server only; absent = plain links).
 * AFFILIATE_QUERY_<PROVIDER> holds a raw tracking query string for any provider,
 * e.g. AFFILIATE_QUERY_AGODA="cid=1234567".
 */
export type EveningQuery = {
  city: string;
  countryCode: string;
  countryName?: string;
  date: string;
  style: "quiet" | "culture" | "nightlife" | "none";
};

/**
 * Where to look for evening plans on a given date: tours (affiliate-capable) for
 * every style, concert/event search for culture, club listings for nightlife.
 * Search links, not results: the sites decide what is on.
 */
export function eveningLinks(q: EveningQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  if (q.style === "none") return [];
  const out: AffiliateLink[] = [];
  const tourQuery = compact(`${q.city} ${q.style === "nightlife" ? "night" : "evening"}`);
  const gyg = withTracking(
    `https://www.getyourguide.com/s/?q=${enc(tourQuery)}&date_from=${q.date}&date_to=${q.date}`,
    "getyourguide",
    ids,
    ids.getYourGuidePartnerId ? `partner_id=${enc(ids.getYourGuidePartnerId)}` : undefined,
  );
  out.push({ provider: "getyourguide", kind: "event", ...gyg });
  if (q.style !== "quiet") {
    const country = q.countryName ? slug(q.countryName) : q.countryCode.toLowerCase();
    out.push({ provider: "eventbrite", kind: "event", ...withTracking(`https://www.eventbrite.com/d/${country}--${slug(q.city)}/events/?start_date=${q.date}&end_date=${q.date}`, "eventbrite", ids) });
    out.push({ provider: "songkick", kind: "event", ...withTracking(`https://www.songkick.com/search?utf8=%E2%9C%93&type=upcoming&query=${enc(q.city)}`, "songkick", ids) });
  }
  if (q.style === "culture") {
    out.push({ provider: "ticketmaster", kind: "event", ...withTracking(`https://www.ticketmaster.com/search?q=${enc(q.city)}`, "ticketmaster", ids) });
  }
  if (q.style === "nightlife") {
    out.push({ provider: "residentadvisor", kind: "event", ...withTracking(`https://ra.co/events/${q.countryCode.toLowerCase()}/${slug(q.city)}`, "residentadvisor", ids) });
  }
  const viator = withTracking(`https://www.viator.com/searchResults/all?text=${enc(tourQuery)}`, "viator", ids, ids.viatorPid ? `pid=${enc(ids.viatorPid)}&mcid=42383&medium=link` : undefined);
  out.push({ provider: "viator", kind: "event", ...viator });
  return out;
}

export function affiliateIdsFromEnv(env: NodeJS.ProcessEnv = process.env): AffiliateIds {
  const query: Partial<Record<AffiliateProvider, string>> = {};
  for (const p of affiliateProviders) {
    const v = env[`AFFILIATE_QUERY_${p.toUpperCase()}`];
    if (v) query[p] = v;
  }
  return {
    bookingAid: env.AFFILIATE_BOOKING_AID || undefined,
    getYourGuidePartnerId: env.AFFILIATE_GETYOURGUIDE_PARTNER_ID || undefined,
    viatorPid: env.AFFILIATE_VIATOR_PID || undefined,
    tiqetsPartner: env.AFFILIATE_TIQETS_PARTNER || undefined,
    klookAid: env.AFFILIATE_KLOOK_AID || undefined,
    kiwiAffilId: env.AFFILIATE_KIWI_AFFILID || undefined,
    query,
  };
}

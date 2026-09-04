import { z } from "zod";

/**
 * Every outbound booking link is built here and only here, so affiliate ids,
 * disclosure labelling and rel="sponsored" are applied consistently.
 * Without affiliate ids the links are plain search links (the disclosure page says so).
 */

export const affiliateLinkSchema = z.object({
  provider: z.enum(["booking", "hotelscom", "agoda", "hostelworld", "getyourguide", "viator", "tiqets", "klook", "kiwi", "skyscanner"]),
  kind: z.enum(["hotel", "ticket", "flight"]),
  url: z.string().url(),
  /** true when an affiliate id was applied */
  affiliate: z.boolean(),
});
export type AffiliateLink = z.infer<typeof affiliateLinkSchema>;

export type AffiliateIds = {
  bookingAid?: string;
  getYourGuidePartnerId?: string;
  viatorPid?: string;
  tiqetsPartner?: string;
  klookAid?: string;
  kiwiAffilId?: string;
};

export type HotelQuery = {
  city: string;
  countryName?: string;
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
  destinationCity: string;
  destinationCountryCode: string;
  departDate: string;
  returnDate: string;
  adults: number;
  children: number;
};

const enc = encodeURIComponent;
const compact = (s: string) => s.trim().replace(/\s+/g, " ");

export function hotelLinks(q: HotelQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const dest = compact(q.countryName ? `${q.city}, ${q.countryName}` : q.city);
  const ages = q.childrenAges.map((a) => `&age=${a}`).join("");
  const booking = `https://www.booking.com/searchresults.html?ss=${enc(dest)}&checkin=${q.checkIn}&checkout=${q.checkOut}&group_adults=${q.adults}&group_children=${q.childrenAges.length}${ages}&no_rooms=1${ids.bookingAid ? `&aid=${enc(ids.bookingAid)}` : ""}`;
  const hotelscom = `https://www.hotels.com/Hotel-Search?destination=${enc(dest)}&startDate=${q.checkIn}&endDate=${q.checkOut}&adults=${q.adults}${q.childrenAges.length ? `&children=${q.childrenAges.map((a) => `1_${a}`).join(",")}` : ""}`;
  const agoda = `https://www.agoda.com/search?textToSearch=${enc(dest)}&checkIn=${q.checkIn}&checkOut=${q.checkOut}&adults=${q.adults}&children=${q.childrenAges.length}&rooms=1`;
  const links: AffiliateLink[] = [
    { provider: "booking", kind: "hotel", url: booking, affiliate: Boolean(ids.bookingAid) },
    { provider: "hotelscom", kind: "hotel", url: hotelscom, affiliate: false },
    { provider: "agoda", kind: "hotel", url: agoda, affiliate: false },
  ];
  if (q.type === "hostel" || q.type === "camping") {
    links.unshift({
      provider: "hostelworld",
      kind: "hotel",
      url: `https://www.hostelworld.com/search?search_keywords=${enc(dest)}&date_from=${q.checkIn}&date_to=${q.checkOut}&number_of_guests=${q.adults + q.childrenAges.length}`,
      affiliate: false,
    });
  }
  return links;
}

export function ticketLinks(q: TicketQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const query = compact(`${q.placeName} ${q.city}`);
  return [
    {
      provider: "getyourguide",
      kind: "ticket",
      url: `https://www.getyourguide.com/s/?q=${enc(query)}&date_from=${q.date}&date_to=${q.date}${ids.getYourGuidePartnerId ? `&partner_id=${enc(ids.getYourGuidePartnerId)}` : ""}`,
      affiliate: Boolean(ids.getYourGuidePartnerId),
    },
    {
      provider: "tiqets",
      kind: "ticket",
      url: `https://www.tiqets.com/en/search?q=${enc(query)}${ids.tiqetsPartner ? `&partner=${enc(ids.tiqetsPartner)}` : ""}`,
      affiliate: Boolean(ids.tiqetsPartner),
    },
    {
      provider: "viator",
      kind: "ticket",
      url: `https://www.viator.com/searchResults/all?text=${enc(query)}${ids.viatorPid ? `&pid=${enc(ids.viatorPid)}` : ""}`,
      affiliate: Boolean(ids.viatorPid),
    },
    {
      provider: "klook",
      kind: "ticket",
      url: `https://www.klook.com/search/?query=${enc(query)}${ids.klookAid ? `&aid=${enc(ids.klookAid)}` : ""}`,
      affiliate: Boolean(ids.klookAid),
    },
  ];
}

export function flightLinks(q: FlightQuery, ids: AffiliateIds = {}): AffiliateLink[] {
  const to = compact(q.destinationCity);
  return [
    {
      provider: "kiwi",
      kind: "flight",
      url: `https://www.kiwi.com/en/search/results/anywhere/${enc(to)}/${q.departDate}/${q.returnDate}?adults=${q.adults}&children=${q.children}${ids.kiwiAffilId ? `&affilid=${enc(ids.kiwiAffilId)}` : ""}`,
      affiliate: Boolean(ids.kiwiAffilId),
    },
    {
      provider: "skyscanner",
      kind: "flight",
      url: `https://www.skyscanner.net/transport/flights/?destination=${enc(to)}&outboundDate=${q.departDate}&inboundDate=${q.returnDate}&adults=${q.adults}&children=${q.children}`,
      affiliate: false,
    },
  ];
}

/** Read affiliate ids from the environment (server only; absent = plain links). */
export function affiliateIdsFromEnv(env: NodeJS.ProcessEnv = process.env): AffiliateIds {
  return {
    bookingAid: env.AFFILIATE_BOOKING_AID || undefined,
    getYourGuidePartnerId: env.AFFILIATE_GETYOURGUIDE_PARTNER_ID || undefined,
    viatorPid: env.AFFILIATE_VIATOR_PID || undefined,
    tiqetsPartner: env.AFFILIATE_TIQETS_PARTNER || undefined,
    klookAid: env.AFFILIATE_KLOOK_AID || undefined,
    kiwiAffilId: env.AFFILIATE_KIWI_AFFILID || undefined,
  };
}

import { describe, expect, it } from "vitest";
import { classifyVenue, distanceMeters, styleKinds, venueHints } from "@/lib/nearby/schema";
import { eveningLinks } from "@/lib/providers/affiliate";
import { matchPlaceByName, normalizeName, syntheticPlace } from "@/lib/nearby/must-visit-core";
import { placeSearchUrl } from "@/lib/trip/google-maps";

describe("nearby venues (milestone 11)", () => {
  it("classifies OSM tags into venue kinds and hints", () => {
    expect(classifyVenue({ amenity: "restaurant" })).toBe("restaurant");
    expect(classifyVenue({ amenity: "nightclub" })).toBe("nightclub");
    expect(classifyVenue({ amenity: "theatre" })).toBe("theatre");
    expect(classifyVenue({ tourism: "viewpoint" })).toBe("viewpoint");
    expect(classifyVenue({ shop: "bakery" })).toBeNull();
    expect(venueHints({ outdoor_seating: "yes", "diet:vegetarian": "yes", bar: "wine_bar" })).toEqual(["outdoor", "vegetarian", "wine"]);
  });

  it("maps each evening style to venue kinds, none to nothing", () => {
    expect(styleKinds.nightlife).toContain("nightclub");
    expect(styleKinds.culture).toContain("theatre");
    expect(styleKinds.quiet).toContain("viewpoint");
    expect(styleKinds.none).toEqual([]);
  });

  it("measures distance in metres", () => {
    expect(distanceMeters({ lat: 38.6916, lng: -9.216 }, { lat: 38.6979, lng: -9.2064 })).toBeGreaterThan(1000);
    expect(distanceMeters({ lat: 38.6916, lng: -9.216 }, { lat: 38.6916, lng: -9.216 })).toBe(0);
  });

  it("builds a Google Maps search at a point", () => {
    expect(placeSearchUrl("restaurants near Belém", 38.69, -9.21)).toContain("maps/search/?api=1&query=restaurants%20near%20Bel%C3%A9m%20%4038.69000%2C-9.21000");
  });
});

describe("evening links", () => {
  it("offers tours for every style and listings only where they fit", () => {
    const quiet = eveningLinks({ city: "Lisbon", countryCode: "PT", countryName: "Portugal", date: "2026-10-17", style: "quiet" });
    expect(quiet.map((l) => l.provider)).toEqual(["getyourguide", "viator"]);
    const culture = eveningLinks({ city: "Lisbon", countryCode: "PT", countryName: "Portugal", date: "2026-10-17", style: "culture" });
    expect(culture.map((l) => l.provider)).toContain("ticketmaster");
    expect(culture.find((l) => l.provider === "eventbrite")?.url).toBe("https://www.eventbrite.com/d/portugal--lisbon/events/?start_date=2026-10-17&end_date=2026-10-17");
    const night = eveningLinks({ city: "Lisbon", countryCode: "PT", date: "2026-10-17", style: "nightlife" });
    expect(night.find((l) => l.provider === "residentadvisor")?.url).toBe("https://ra.co/events/pt/lisbon");
    expect(eveningLinks({ city: "Lisbon", countryCode: "PT", date: "2026-10-17", style: "none" })).toEqual([]);
    for (const l of [...quiet, ...culture, ...night]) expect(l.kind).toBe("event");
  });
});

describe("wishlist resolution", () => {
  const cities = [{ slug: "lisbon", countryCode: "PT", names: { en: "Lisbon", local: "Lisboa" }, center: { lat: 38.72, lng: -9.14 }, bbox: [38.6, -9.3, 38.8, -9.0] as [number, number, number, number] }];
  const place = syntheticPlace({ name: "Torre de Belém", placeId: null }, { lat: 38.6916, lng: -9.216 }, cities, { wikidata: "Q215003" })!;

  it("normalises names for matching", () => {
    expect(normalizeName("Torre de Belém.")).toBe("torre de belem");
    expect(matchPlaceByName("belem tower", [{ ...place, names: { en: "Belém Tower", local: "Torre de Belém" } }])?.id).toBe(place.id);
    expect(matchPlaceByName("xy", [place])).toBeNull();
  });

  it("creates an unverified catalogue entry for a place we only know from the traveller", () => {
    expect(place.id).toBe("pt-wish-torre-de-belem");
    expect(place.dataQuality).toBe("unverified");
    expect(place.source).toBe("user");
    expect(place.wikidata).toBe("Q215003");
    expect(place.city).toBe("lisbon");
  });
});

import { describe, expect, it } from "vitest";
import { placeImage, wikiThumb } from "@/lib/images";

describe("photos", () => {
  it("rewrites a Commons thumbnail to another width", () => {
    const url = "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Torre_Belem.jpg/320px-Torre_Belem.jpg";
    // Only Wikimedia's rendered widths work: 640 rounds up to 960, and the API's tracking query goes.
    expect(wikiThumb(url, 640)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Torre_Belem.jpg/960px-Torre_Belem.jpg");
    expect(wikiThumb(`${url}?utm_source=x`, 240)).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Torre_Belem.jpg/250px-Torre_Belem.jpg");
    expect(wikiThumb(url, 4000)).toContain("/1920px-");
    expect(wikiThumb("https://example.com/x.jpg", 640)).toBe("https://example.com/x.jpg");
  });

  it("prefers the UI language's article photo, then any other", () => {
    const he = { url: "https://u/thumb/a/he.jpg/320px-he.jpg", page: "https://he.wikipedia.org/wiki/x" };
    const en = { url: "https://u/thumb/a/en.jpg/320px-en.jpg", page: "https://en.wikipedia.org/wiki/x" };
    expect(placeImage({ summary: { he: { image: he }, en: { image: en } } }, "he")).toEqual(he);
    expect(placeImage({ summary: { he: { image: null }, en: { image: en } } }, "he")).toEqual(en);
    expect(placeImage({ summary: { he: {} } }, "he")).toBeNull();
    expect(placeImage(undefined, "he")).toBeNull();
  });
});

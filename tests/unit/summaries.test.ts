import { describe, expect, it } from "vitest";
import { trimExtract, wikiLang } from "@/lib/providers/summaries-core";
import { googleTranslateUrl, placeSummary } from "@/lib/guest/plan-helpers";

describe("trimExtract", () => {
  it("keeps one or two sentences and drops parentheticals", () => {
    const text = "Livraria Bertrand (Portuguese pronunciation: [liˈvɾɐɾiɐ]) is a bookstore in Lisbon. Founded in 1732, it is the oldest operating bookstore in the world. It has many branches. Another sentence.";
    const out = trimExtract(text);
    expect(out).toBe("Livraria Bertrand is a bookstore in Lisbon. Founded in 1732, it is the oldest operating bookstore in the world.");
  });

  it("caps very long first sentences with an ellipsis", () => {
    const long = "A".repeat(400) + ".";
    const out = trimExtract(long);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith("…")).toBe(true);
  });

  it("handles Hebrew and Japanese punctuation", () => {
    expect(trimExtract("מגדל בלם הוא מבצר מהמאה ה-16 בליסבון. הוא אתר מורשת עולמית. עוד משפט ארוך מאוד שלא צריך.")).toBe("מגדל בלם הוא מבצר מהמאה ה-16 בליסבון. הוא אתר מורשת עולמית.");
    expect(trimExtract("東京タワーは東京都港区にある電波塔である。高さは333メートル。")).toContain("東京タワー");
  });

  it("maps the Chinese UI locale to the zh Wikipedia", () => {
    expect(wikiLang("zh-CN")).toBe("zh");
    expect(wikiLang("he")).toBe("he");
  });
});

describe("placeSummary", () => {
  const place = {
    summary: {
      en: { text: "A park in Lisbon.", url: "https://en.wikipedia.org/wiki/Park" },
      he: { text: "פארק בליסבון.", url: "https://en.wikipedia.org/wiki/Park", translatedFrom: "en" },
    },
  };

  it("prefers the UI language and reports the language shown", () => {
    expect(placeSummary(place, "he")).toEqual({ text: "פארק בליסבון.", url: "https://en.wikipedia.org/wiki/Park", translatedFrom: "en", lang: "he" });
    expect(placeSummary(place, "fr")).toEqual({ text: "A park in Lisbon.", url: "https://en.wikipedia.org/wiki/Park", lang: "en" });
    expect(placeSummary({ summary: {} }, "he")).toBeNull();
    expect(placeSummary(undefined, "he")).toBeNull();
  });

  it("builds a Google Translate link for text shown in another language", () => {
    const url = googleTranslateUrl("A park in Lisbon.", "en", "he");
    expect(url).toContain("https://translate.google.com/?sl=en&tl=he&text=A%20park%20in%20Lisbon.");
  });
});

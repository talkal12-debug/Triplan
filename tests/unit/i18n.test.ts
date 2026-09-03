import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { locales, localeDir, localeNames, defaultLocale, isLocale } from "@/lib/i18n/locales";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flatten(value, path);
  });
}

function load(locale: string): Tree {
  const file = join(process.cwd(), "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Tree;
}

describe("locale config", () => {
  it("has a direction and a display name for every locale", () => {
    for (const locale of locales) {
      expect(localeDir[locale]).toMatch(/^(rtl|ltr)$/);
      expect(localeNames[locale].length).toBeGreaterThan(0);
    }
  });

  it("uses Hebrew as the default locale, rendered RTL", () => {
    expect(defaultLocale).toBe("he");
    expect(localeDir.he).toBe("rtl");
    expect(localeDir.en).toBe("ltr");
  });

  it("recognises only supported locale codes", () => {
    expect(isLocale("he")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("xx")).toBe(false);
  });
});

describe("message files", () => {
  const refKeys = flatten(load(defaultLocale)).sort();

  it("reference locale has messages", () => {
    expect(refKeys.length).toBeGreaterThan(20);
  });

  it.each(locales.filter((l) => l !== defaultLocale))(
    "%s has exactly the same keys as the reference",
    (locale) => {
      expect(flatten(load(locale)).sort()).toEqual(refKeys);
    },
  );

  it.each(locales)("%s has no empty strings", (locale) => {
    const tree = load(locale);
    const empty = flatten(tree).filter((path) => {
      const value = path.split(".").reduce<string | Tree>((node, part) => (node as Tree)[part], tree);
      return typeof value === "string" && value.trim() === "";
    });
    expect(empty).toEqual([]);
  });
});

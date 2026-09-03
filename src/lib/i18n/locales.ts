/**
 * Single source of truth for supported locales.
 * Milestone 1 ships he + en. The remaining 10 locales are added in milestone 8.
 */
export const locales = ["he", "en"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

export type TextDirection = "rtl" | "ltr";

export const localeDir: Record<Locale, TextDirection> = {
  he: "rtl",
  en: "ltr",
};

/** Native display name of each locale, shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  he: "עברית",
  en: "English",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Single source of truth for supported locales.
 * Milestone 1 shipped he + en; milestone 8a added the remaining ten.
 * Order here is the order in the language switcher.
 */
export const locales = ["he", "en", "ar", "ru", "es", "fr", "de", "it", "pt", "zh-CN", "ja", "hi"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "he";

export type TextDirection = "rtl" | "ltr";

export const localeDir: Record<Locale, TextDirection> = {
  he: "rtl",
  en: "ltr",
  ar: "rtl",
  ru: "ltr",
  es: "ltr",
  fr: "ltr",
  de: "ltr",
  it: "ltr",
  pt: "ltr",
  "zh-CN": "ltr",
  ja: "ltr",
  hi: "ltr",
};

/** Native display name of each locale, shown in the language switcher. */
export const localeNames: Record<Locale, string> = {
  he: "עברית",
  en: "English",
  ar: "العربية",
  ru: "Русский",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  "zh-CN": "简体中文",
  ja: "日本語",
  hi: "हिन्दी",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

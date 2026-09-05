import type { Locale } from "@/lib/i18n/locales";
import type { GuestPlan } from "./trips";
import type { PlaceSeed } from "@/lib/data/schemas";

export function hhmm(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** "Hebrew name / Local name" when they differ. */
export function placeLabel(place: PlaceSeed | undefined, locale: Locale, fallback = ""): string {
  if (!place) return fallback;
  const localized = place.names[locale] ?? place.names.en;
  return localized === place.nameLocal ? localized : `${localized} / ${place.nameLocal}`;
}

export function cityLabel(plan: GuestPlan, slug: string, locale: Locale): string {
  const c = plan.cities.find((x) => x.slug === slug);
  return c ? (c.names[locale] ?? c.names.en) : slug;
}

export function localDateOf(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function googleMapsDirections(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** The place's one-paragraph description in the UI language, falling back to English. */
export function placeSummary(place: { summary?: Record<string, { text: string; url: string | null }> } | undefined, locale: string): { text: string; url: string | null } | null {
  if (!place?.summary) return null;
  return place.summary[locale] ?? place.summary.en ?? null;
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Reason, Warning } from "@/lib/planner/itinerary";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";
import { cityLabel, placeLabel } from "@/lib/guest/plan-helpers";

/** Translators for the engine's structured reasons and warnings. */
export function usePlanText(plan: GuestPlan) {
  const t = useTranslations("plan");
  const ti = useTranslations("wizard.interests.options");
  const locale = useLocale() as Locale;

  const reasonText = (r: Reason): string => {
    const params = { ...r.params } as Record<string, string | number>;
    if (r.code === "interest_match" && typeof params.interest === "string") params.interest = ti(params.interest as never);
    if (r.code === "open_on_day" && typeof params.weekday === "string") params.weekday = t(`weekdays.${params.weekday}` as never);
    if (r.code === "closed_other_days" && typeof params.weekdays === "string") params.weekdays = params.weekdays.split(",").map((w) => t(`weekdays.${w}` as never)).join(", ");
    if (r.code === "top_interest" && typeof params.interest === "string") params.interest = ti(params.interest as never);
    if (r.code === "day_trip" && typeof params.city === "string") params.city = cityLabel(plan, params.city, locale);
    return t(`reasons.${r.code}`, params);
  };

  const warningText = (w: Warning): string => {
    const params = { ...w.params } as Record<string, string | number>;
    if (typeof params.city === "string") params.city = cityLabel(plan, params.city, locale);
    if (typeof params.base === "string") params.base = cityLabel(plan, params.base, locale);
    return t(`warnings.${w.code}`, params);
  };

  const name = (placeId: string | null | undefined) => placeLabel(placeId ? plan.places[placeId] : undefined, locale, placeId ?? "");

  return { t, locale, reasonText, warningText, name, city: (slug: string) => cityLabel(plan, slug, locale) };
}

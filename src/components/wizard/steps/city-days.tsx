"use client";

import { useTranslations } from "next-intl";
import { FieldLabel, inputClass } from "../controls";
import type { StepProps } from "../step-props";

/**
 * "How many days in each destination?" for trips with more than one chosen city. The first
 * city is the base and gets the rest; each other one is "Triplan decides" or a number of days
 * (one or two near the base become day trips from it).
 */
export function CityDays({ prefs, set, ctx }: Pick<StepProps, "prefs" | "set" | "ctx">) {
  const t = useTranslations("wizard.dates.cityDays");
  const rows = prefs.destinations.flatMap((d, di) =>
    d.cities.map((slug, ci) => {
      const seed = (ctx.cities[d.countryCode] ?? []).find((c) => c.slug === slug)?.name;
      const custom = (d.customCities ?? []).find((c) => c.slug === slug);
      const name = seed ?? custom?.names[ctx.locale] ?? custom?.names.en ?? slug;
      return { di, slug, name, first: di === 0 && ci === 0 };
    }),
  );
  if (rows.length < 2) return null;
  const total = prefs.dates.days;
  const asked = rows.reduce((s, r) => s + (prefs.destinations[r.di].cityDays?.[r.slug] ?? 0), 0);
  const base = rows.find((r) => r.first)!;

  function change(di: number, slug: string, value: number | null) {
    set(
      "destinations",
      prefs.destinations.map((d, i) => {
        if (i !== di) return d;
        const next = { ...(d.cityDays ?? {}) };
        if (value === null) delete next[slug];
        else next[slug] = value;
        return { ...d, cityDays: Object.keys(next).length ? next : undefined };
      }),
    );
  }

  return (
    <fieldset className="space-y-3 rounded-md border bg-card p-4">
      <legend className="px-1 text-sm font-medium">{t("title", { days: total })}</legend>
      <p className="text-xs text-muted-foreground">{t("hint", { base: base.name })}</p>
      <ul className="space-y-2">
        {rows
          .filter((r) => !r.first)
          .map((r) => {
            const id = `city-days-${r.slug}`;
            const value = prefs.destinations[r.di].cityDays?.[r.slug] ?? null;
            return (
              <li key={`${r.di}-${r.slug}`} className="flex flex-wrap items-center justify-between gap-2">
                <FieldLabel htmlFor={id}>{r.name}</FieldLabel>
                <select id={id} value={value ?? ""} onChange={(e) => change(r.di, r.slug, e.target.value ? Number(e.target.value) : null)} className={`${inputClass} w-auto min-w-48`}>
                  <option value="">{t("auto")}</option>
                  {Array.from({ length: Math.max(1, total - 1) }, (_, k) => k + 1).map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? t("oneDay") : t("days", { count: n })}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
      </ul>
      <p className="text-xs text-muted-foreground">{t("rest", { base: base.name, count: Math.max(1, total - asked) })}</p>
      {asked > total - 1 && (
        <p role="alert" className="text-xs text-destructive">
          {t("tooMany", { days: total })}
        </p>
      )}
    </fieldset>
  );
}

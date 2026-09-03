"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Lock, Search, X } from "lucide-react";
import { CountryFlag } from "@/components/country-flag";
import { Badge } from "@/components/ui/badge";
import { Chip, inputClass } from "../controls";
import type { StepProps } from "../step-props";
import { cn } from "@/lib/utils";

const MAX_DESTINATIONS = 3;
const TOP_COUNT = 30;

export function DestinationStep({ prefs, set, ctx, errors }: StepProps) {
  const t = useTranslations("wizard.destination");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const selectedCodes = prefs.destinations.map((d) => d.countryCode);
  const byCode = useMemo(() => new Map(ctx.countries.map((c) => [c.code, c])), [ctx.countries]);

  const results = useMemo(() => {
    if (!deferred) return ctx.countries.slice(0, TOP_COUNT);
    return ctx.countries.filter((c) => c.search.some((s) => s.includes(deferred)));
  }, [ctx.countries, deferred]);

  const full = prefs.destinations.length >= MAX_DESTINATIONS;

  function toggleCountry(code: string) {
    if (selectedCodes.includes(code)) {
      set(
        "destinations",
        prefs.destinations.filter((d) => d.countryCode !== code),
      );
    } else if (!full) {
      set("destinations", [...prefs.destinations, { countryCode: code, cities: [] }]);
    }
  }

  function toggleCity(code: string, slug: string) {
    set(
      "destinations",
      prefs.destinations.map((d) =>
        d.countryCode !== code
          ? d
          : { ...d, cities: d.cities.includes(slug) ? d.cities.filter((s) => s !== slug) : [...d.cities, slug] },
      ),
    );
  }

  return (
    <div className="space-y-6">
      {prefs.destinations.length > 0 && (
        <section aria-labelledby="selected-title" className="space-y-4">
          <h3 id="selected-title" className="font-medium">
            {t("selected")}
          </h3>
          {prefs.destinations.map((d) => {
            const c = byCode.get(d.countryCode);
            if (!c) return null;
            const cities = ctx.cities[d.countryCode] ?? [];
            return (
              <div key={d.countryCode} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <CountryFlag code={c.code} size={24} />
                  <span className="flex-1 font-semibold">
                    {c.name}
                    {c.local && <span className="ms-2 text-sm font-normal text-muted-foreground" dir="auto">{c.local}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCountry(d.countryCode)}
                    aria-label={t("remove", { name: c.name })}
                    className="grid size-9 place-items-center rounded-full hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                {cities.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium">{t("cities", { country: c.name })}</p>
                    <p className="text-xs text-muted-foreground">{t("citiesHint")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cities.map((city) => (
                        <Chip
                          key={city.slug}
                          selected={d.cities.includes(city.slug)}
                          onToggle={() => toggleCity(d.countryCode, city.slug)}
                        >
                          {city.name}
                          {city.local && <span className="text-xs opacity-70" dir="auto">{city.local}</span>}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {full && <p className="text-sm text-muted-foreground">{t("maxReached")}</p>}
        </section>
      )}

      <section aria-labelledby="search-title">
        <label className="relative block">
          <span id="search-title" className="sr-only">
            {t("search")}
          </span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className={cn(inputClass, "ps-11")}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">{t("underConstructionHint")}</p>
        {!deferred && <p className="mt-1 text-xs text-muted-foreground">{t("showingTop", { count: TOP_COUNT })}</p>}
        {results.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{t("noResults")}</p>}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {results.map((c) => {
            const selected = selectedCodes.includes(c.code);
            const disabled = !c.demo || (full && !selected);
            return (
              <li key={c.code}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  aria-label={t("select", { name: c.name })}
                  disabled={disabled}
                  onClick={() => toggleCountry(c.code)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    selected ? "border-primary bg-primary/5" : "border-border bg-card",
                    disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/40",
                  )}
                >
                  <CountryFlag code={c.code} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.local && (
                      <span className="block truncate text-xs text-muted-foreground" dir="auto">
                        {c.local}
                      </span>
                    )}
                  </span>
                  {c.demo ? (
                    selected ? (
                      <Check className="size-5 text-primary" aria-hidden />
                    ) : (
                      <Badge variant="secondary">{t("demoBadge")}</Badge>
                    )
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Lock className="size-3" aria-hidden />
                      {t("underConstruction")}
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {errors.includes("destination.required") && (
        <p role="alert" className="text-sm text-destructive">
          {t("required")}
        </p>
      )}
    </div>
  );
}

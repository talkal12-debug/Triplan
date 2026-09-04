"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Globe, Search, X } from "lucide-react";
import { CountryFlag } from "@/components/country-flag";
import { Badge } from "@/components/ui/badge";
import { Chip, inputClass } from "../controls";
import type { StepProps } from "../step-props";
import type { CustomCity, Destination } from "@/lib/planner/types";
import { cn } from "@/lib/utils";

const MAX_DESTINATIONS = 3;
const TOP_COUNT = 30;

type CityResult = { slug: string; names: { en: string; he?: string; local?: string; [k: string]: string | undefined }; center: { lat: number; lng: number }; bbox: [number, number, number, number] };

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

  function updateDestination(code: string, patch: (d: Destination) => Destination) {
    set(
      "destinations",
      prefs.destinations.map((d) => (d.countryCode === code ? patch(d) : d)),
    );
  }

  function toggleCity(code: string, slug: string) {
    updateDestination(code, (d) => ({ ...d, cities: d.cities.includes(slug) ? d.cities.filter((s) => s !== slug) : [...d.cities, slug] }));
  }

  function addCustomCity(code: string, city: CityResult) {
    updateDestination(code, (d) => {
      if (d.cities.includes(city.slug)) return d;
      const custom: CustomCity = { slug: city.slug, names: { ...city.names, en: city.names.en } as CustomCity["names"], center: city.center, bbox: city.bbox };
      return { ...d, cities: [...d.cities, city.slug], customCities: [...(d.customCities ?? []), custom] };
    });
  }

  function removeCustomCity(code: string, slug: string) {
    updateDestination(code, (d) => ({
      ...d,
      cities: d.cities.filter((s) => s !== slug),
      customCities: (d.customCities ?? []).filter((c) => c.slug !== slug),
    }));
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
                {c.demo ? (
                  cities.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium">{t("cities", { country: c.name })}</p>
                      <p className="text-xs text-muted-foreground">{t("citiesHint")}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {cities.map((city) => (
                          <Chip key={city.slug} selected={d.cities.includes(city.slug)} onToggle={() => toggleCity(d.countryCode, city.slug)}>
                            {city.name}
                            {city.local && <span className="text-xs opacity-70" dir="auto">{city.local}</span>}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )
                ) : (
                  <CustomCityPicker
                    countryCode={d.countryCode}
                    countryName={c.name}
                    locale={ctx.locale}
                    chosen={d.customCities ?? []}
                    onAdd={(city) => addCustomCity(d.countryCode, city)}
                    onRemove={(slug) => removeCustomCity(d.countryCode, slug)}
                    hasError={errors.includes("destination.cityRequired")}
                  />
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
        <p className="mt-2 text-xs text-muted-foreground">{t("osmHint")}</p>
        {!deferred && <p className="mt-1 text-xs text-muted-foreground">{t("showingTop", { count: TOP_COUNT })}</p>}
        {results.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{t("noResults")}</p>}
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {results.map((c) => {
            const selected = selectedCodes.includes(c.code);
            const disabled = full && !selected;
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
                  {selected ? (
                    <Check className="size-5 text-primary" aria-hidden />
                  ) : c.demo ? (
                    <Badge variant="secondary">{t("demoBadge")}</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Globe className="size-3" aria-hidden />
                      {t("osmBadge")}
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

/** City search (Nominatim through /api/cities) for countries without a curated seed. */
function CustomCityPicker({
  countryCode,
  countryName,
  locale,
  chosen,
  onAdd,
  onRemove,
  hasError,
}: {
  countryCode: string;
  countryName: string;
  locale: string;
  chosen: CustomCity[];
  onAdd: (city: CityResult) => void;
  onRemove: (slug: string) => void;
  hasError: boolean;
}) {
  const t = useTranslations("wizard.destination");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityResult[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const deferred = useDeferredValue(query.trim());

  useEffect(() => {
    if (deferred.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities?country=${countryCode}&q=${encodeURIComponent(deferred)}&locale=${locale}`, { signal: controller.signal });
        const json = (await res.json()) as { cities?: CityResult[] };
        setResults(json.cities ?? []);
        setStatus("idle");
      } catch (err) {
        if ((err as Error).name !== "AbortError") setStatus("error");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [deferred, countryCode, locale]);

  const label = (names: CityResult["names"]) => {
    const l = names[locale] ?? names.en;
    return names.local && names.local !== l ? `${l} / ${names.local}` : l;
  };

  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{t("osmCities", { country: countryName })}</p>
      <p className="text-xs text-muted-foreground">{t("osmCitiesHint")}</p>
      {chosen.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {chosen.map((c) => (
            <li key={c.slug}>
              <Chip selected onToggle={() => onRemove(c.slug)} ariaLabel={t("remove", { name: label(c.names) })}>
                {label(c.names)}
                <X className="size-3.5" aria-hidden />
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <label className="relative mt-2 block">
        <span className="sr-only">{t("citySearch")}</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("citySearchPlaceholder")}
          autoComplete="off"
          className={cn(inputClass, "h-11 ps-10 text-sm")}
          aria-invalid={hasError}
        />
      </label>
      {status === "loading" && <p className="mt-1 text-xs text-muted-foreground">{t("citySearching")}</p>}
      {status === "error" && <p className="mt-1 text-xs text-destructive">{t("citySearchError")}</p>}
      {results.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {results
            .filter((r) => !chosen.some((c) => c.slug === r.slug))
            .map((r) => (
              <li key={r.slug}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(r);
                    setQuery("");
                  }}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-start text-sm hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Globe className="size-4 text-muted-foreground" aria-hidden />
                  {label(r.names)}
                </button>
              </li>
            ))}
        </ul>
      )}
      {hasError && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {t("cityRequired")}
        </p>
      )}
    </div>
  );
}

"use client";

import { useDeferredValue, useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldLabel, inputClass } from "../controls";
import type { StepProps } from "../step-props";
import type { MustVisit } from "@/lib/planner/types";

type Suggestion = { placeId: string | null; name: string; city: string; lat?: number; lng?: number };

/**
 * Wishlist (milestone 11): places the traveller insists on. Picked from our
 * catalogue when we have the destination, otherwise typed freely and resolved
 * when the plan is built (name match, then OpenStreetMap).
 */
export function WishlistStep({ prefs, set, ctx }: StepProps) {
  const t = useTranslations("wizard.wishlist");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const inputId = useId();
  const list = prefs.mustVisit;
  const full = list.length >= 20;

  const countries = prefs.destinations.map((d) => d.countryCode).join(",");
  const cities = prefs.destinations.flatMap((d) => d.cities).join(",");

  useEffect(() => {
    if (deferred.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const params = new URLSearchParams({ q: deferred, countries, cities, locale: ctx.locale });
    fetch(`/api/places/suggest?${params}`, { signal: controller.signal })
      .then(async (r) => (r.ok ? ((await r.json()) as { suggestions: Suggestion[] }).suggestions : []))
      .then((s) => setSuggestions(s.filter((x) => !list.some((m) => (x.placeId && m.placeId === x.placeId) || m.name === x.name))))
      .catch(() => undefined)
      .finally(() => setSearching(false));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the list only filters suggestions
  }, [deferred, countries, cities, ctx.locale]);

  function add(entry: MustVisit) {
    if (full || list.some((m) => (entry.placeId && m.placeId === entry.placeId) || m.name.toLowerCase() === entry.name.toLowerCase())) return;
    set("mustVisit", [...list, entry]);
    setQuery("");
    setSuggestions([]);
  }

  function addTyped() {
    const name = query.trim();
    if (name.length < 2) return;
    add({ name, placeId: null });
  }

  function remove(index: number) {
    set("mustVisit", list.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="space-y-2">
        <FieldLabel htmlFor={inputId} hint={t("hint")}>
          {t("label")}
        </FieldLabel>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" aria-hidden />
            <input
              id={inputId}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (suggestions[0]) add({ name: suggestions[0].name, placeId: suggestions[0].placeId, lat: suggestions[0].lat, lng: suggestions[0].lng });
                  else addTyped();
                }
              }}
              placeholder={t("placeholder")}
              className={`${inputClass} ps-9`}
              autoComplete="off"
              disabled={full}
              aria-describedby={`${inputId}-hint`}
            />
          </div>
          <Button type="button" variant="outline" onClick={addTyped} disabled={full || query.trim().length < 2}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </div>
        <p id={`${inputId}-hint`} className="sr-only">
          {t("hint")}
        </p>
        {(suggestions.length > 0 || searching) && (
          <ul className="divide-y rounded-2xl border bg-card" aria-label={t("suggestions")}>
            {searching && suggestions.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{t("searching")}</li>}
            {suggestions.map((s) => (
              <li key={`${s.placeId ?? "free"}:${s.name}`}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted"
                  onClick={() => add({ name: s.name, placeId: s.placeId, lat: s.lat, lng: s.lng })}
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.city}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {deferred.length >= 2 && !searching && suggestions.length === 0 && <p className="text-xs text-muted-foreground">{t("noResults")}</p>}
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="space-y-2" aria-label={t("listLabel")}>
          {list.map((m, i) => (
            <li key={`${m.placeId ?? "free"}:${m.name}`} className="flex items-center gap-2 rounded-2xl border bg-card px-3 py-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
              <span className="flex-1 text-sm">
                {m.name}
                {!m.placeId && <span className="ms-2 text-xs text-muted-foreground">{t("resolvedLater")}</span>}
              </span>
              <Button type="button" size="icon" variant="ghost" aria-label={t("remove", { name: m.name })} onClick={() => remove(i)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {full && <p className="text-xs text-muted-foreground">{t("full")}</p>}
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";

export type CountryListItem = {
  code: string;
  flag: string;
  /** Name in the UI locale */
  name: string;
  /** Native name, when different */
  local: string | null;
  /** All searchable spellings, lower-cased */
  search: string[];
  demo: boolean;
};

type Props = { countries: CountryListItem[] };

export function CountrySearch({ countries }: Props) {
  const t = useTranslations("knowBefore");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferred) return countries;
    return countries.filter((c) => c.search.some((s) => s.includes(deferred)));
  }, [countries, deferred]);

  const demo = filtered.filter((c) => c.demo);
  const rest = filtered.filter((c) => !c.demo);

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{t("searchLabel")}</span>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-4 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {filtered.length === 0 ? t("noResults") : t("resultsCount", { count: filtered.length })}
      </p>

      {demo.length > 0 && (
        <section className="mt-6" aria-labelledby="demo-title">
          <h2 id="demo-title" className="text-lg font-semibold">
            {t("demoTitle")}
          </h2>
          <CountryGrid items={demo} demoLabel={t("demoBadge")} />
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-8" aria-labelledby="all-title">
          <h2 id="all-title" className="text-lg font-semibold">
            {t("allTitle")}
          </h2>
          <CountryGrid items={rest} demoLabel={t("demoBadge")} />
        </section>
      )}
    </div>
  );
}

function CountryGrid({ items, demoLabel }: { items: CountryListItem[]; demoLabel: string }) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <li key={c.code}>
          <Link
            href={`/know-before/${c.code.toLowerCase()}`}
            className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
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
            {c.demo && <Badge variant="secondary">{demoLabel}</Badge>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = { total: number; initiallyShown: number };

/**
 * The only interactive part of the country index. The rows are plain
 * server-rendered HTML with a data-search attribute; rows past the first screenfuls
 * carry data-more and start hidden. Typing filters every row; "show all" reveals the rest.
 * Nothing but this box is hydrated.
 */
export function CountryFilter({ total, initiallyShown }: Props) {
  const t = useTranslations("knowBefore");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState(initiallyShown);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      let shown = 0;
      for (const section of document.querySelectorAll<HTMLElement>("[data-country-section]")) {
        let inSection = 0;
        for (const row of section.querySelectorAll<HTMLElement>("[data-search]")) {
          const visible = q ? (row.dataset.search ?? "").includes(q) : expanded || row.dataset.more === undefined;
          row.hidden = !visible;
          if (visible) inSection++;
        }
        section.hidden = inSection === 0;
        shown += inSection;
      }
      setCount(shown);
    }, 80);
  }, [query, expanded]);

  const showMore = !expanded && !query.trim() && count < total;

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{t("searchLabel")}</span>
        <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-input bg-card ps-11 pe-4 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {count === 0 ? t("noResults") : t("resultsCount", { count })}
        </p>
        {showMore && (
          <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
            <ChevronDown aria-hidden />
            {t("showAll", { count: total })}
          </Button>
        )}
      </div>
    </div>
  );
}

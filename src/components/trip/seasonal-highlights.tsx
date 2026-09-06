"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CalendarHeart, ExternalLink, Flower2, Sparkles, TriangleAlert } from "lucide-react";
import { seasonalText, type SeasonalItem } from "@/lib/data/seasonal";
import { cn } from "@/lib/utils";

const icons = { festival: Sparkles, nature: Flower2, market: CalendarHeart, caution: TriangleAlert } as const;

/**
 * "What is on during your dates" (milestone 12): curated seasonal highlights that
 * overlap the trip. Dates move every year, so every row links to its source.
 */
export function SeasonalHighlights({ items, className, compact = false }: { items: (SeasonalItem & { firstDate?: string })[]; className?: string; compact?: boolean }) {
  const t = useTranslations("plan.seasonal");
  const locale = useLocale();
  const format = useFormatter();
  if (items.length === 0) return null;
  const window = (i: SeasonalItem) => {
    const year = new Date().getFullYear();
    const f = format.dateTime(new Date(`${year}-${i.from}T12:00:00`), { day: "numeric", month: "short" });
    const to = format.dateTime(new Date(`${year}-${i.to}T12:00:00`), { day: "numeric", month: "short" });
    return i.from === i.to ? f : `${f} – ${to}`;
  };
  return (
    <section className={cn("rounded-md border bg-card p-4", className)} data-testid="seasonal" aria-label={t("title")}>
      <h3 className="font-medium">{t("title")}</h3>
      <ul className={cn("mt-2 space-y-2", compact && "space-y-1")}>
        {items.map((i) => {
          const Icon = icons[i.kind];
          return (
            <li key={i.id} className="flex items-start gap-2 text-sm">
              <Icon className={cn("mt-0.5 size-4 shrink-0", i.kind === "caution" ? "text-amber-600" : "text-primary")} aria-hidden />
              <div>
                <p>
                  <span className="font-medium">{seasonalText(i.names, locale)}</span>
                  <span className="text-muted-foreground"> · {window(i)}</span>
                  <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{t(`kinds.${i.kind}`)}</span>
                </p>
                {!compact && <p className="text-muted-foreground">{seasonalText(i.description, locale)}</p>}
                <a href={i.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline">
                  <ExternalLink className="size-3" aria-hidden />
                  {t("source")}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("datesVary")}</p>
    </section>
  );
}

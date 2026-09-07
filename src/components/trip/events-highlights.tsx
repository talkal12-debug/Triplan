"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useCalendarFormat } from "@/lib/i18n/use-calendar-format";
import { Ticket } from "lucide-react";
import type { GuestPlan } from "@/lib/guest/trips";

/**
 * Every real event found for the trip's dates (from the evenings), in one list
 * with a "buy tickets" button each; the day panels repeat their own. Shown only
 * when an events provider answered (needs a Ticketmaster key).
 */
export function EventsHighlights({ plan }: { plan: GuestPlan }) {
  const t = useTranslations("plan.events");
  const te = useTranslations("plan.evening");
  const format = useFormatter();
  const fmtDate = useCalendarFormat();
  const evenings = plan.extras?.evenings ?? {};
  const events = Object.entries(evenings)
    .flatMap(([dayIndex, e]) => e.events.map((ev) => ({ ...ev, dayIndex: Number(dayIndex), date: plan.itinerary.days[Number(dayIndex)]?.date })))
    .sort((a, b) => a.start.localeCompare(b.start));
  if (events.length === 0) return null;
  return (
    <section className="rounded-md border bg-card p-4" data-testid="events" aria-label={t("title")}>
      <h3 className="font-medium">{t("title")}</h3>
      <ul className="mt-2 space-y-2">
        {events.slice(0, 12).map((e) => (
          <li key={`${e.dayIndex}-${e.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="text-xs text-muted-foreground">{e.date && fmtDate(e.date, { day: "numeric", month: "short" })}</span>
            <span className="font-medium">{e.name}</span>
            {e.preferred && <span className="rounded-sm border border-sunset/60 px-1.5 py-0.5 text-[11px] leading-none">{te("preferred")}</span>}
            <span className="text-xs text-muted-foreground">
              {e.venue && `${e.venue} · `}
              {e.category}
              {e.priceMin != null && e.currency && ` · ${te("price", { price: format.number(e.priceMin, { style: "currency", currency: e.currency, maximumFractionDigits: 0 }) })}`}
            </span>
            <a href={e.url} target="_blank" rel="noopener noreferrer sponsored" className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
              <Ticket className="size-3" aria-hidden />
              {te("buy")}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("source", { source: events[0].source })}</p>
    </section>
  );
}

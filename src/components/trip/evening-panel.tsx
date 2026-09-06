"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CalendarDays, ExternalLink, Moon, Ticket, Utensils } from "lucide-react";
import type { Evening } from "@/lib/nearby/schema";
import { placeSearchUrl } from "@/lib/trip/google-maps";
import { AffiliateLinks } from "./affiliate-links";
import { VenueList } from "./venue-list";

/**
 * The evening of a day (milestone 11): dinner near the hotel, venues for the
 * traveller's evening style, real events on that date when an events provider
 * is configured, and search links otherwise. "none" shows dinner only.
 */
export function EveningPanel({ evening, date, cityLabel }: { evening: Evening; date: string; cityLabel: string }) {
  const t = useTranslations("plan.evening");
  const tn = useTranslations("plan.nearby");
  const format = useFormatter();
  const style = evening.style;
  const mapsQuery = style === "nightlife" ? t("mapsNightlife") : style === "culture" ? t("mapsCulture") : t("mapsQuiet");
  return (
    <section className="space-y-3 rounded-2xl border border-dashed bg-card/60 p-4" data-testid="evening" aria-label={t("title")}>
      <div className="flex flex-wrap items-center gap-2">
        <Moon className="size-4 text-primary" aria-hidden />
        <h3 className="font-medium">{t("title")}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t(`styles.${style}`)}</span>
      </div>

      <div>
        <p className="flex items-center gap-1 text-xs font-medium">
          <Utensils className="size-3.5" aria-hidden />
          {t("dinner")}
        </p>
        {evening.dinner.length > 0 ? <VenueList venues={evening.dinner} className="mt-1" compact /> : <p className="mt-1 text-xs text-muted-foreground">{tn("noDining")}</p>}
        <a
          href={placeSearchUrl(`${tn("mapsQuery")} ${cityLabel}`, evening.center.lat, evening.center.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          <ExternalLink className="size-3" aria-hidden />
          {tn("searchMaps")}
        </a>
      </div>

      {style !== "none" && (
        <div>
          <p className="text-xs font-medium">{t(`venuesTitle.${style}`)}</p>
          {evening.venues.length > 0 ? <VenueList venues={evening.venues} className="mt-1" /> : <p className="mt-1 text-xs text-muted-foreground">{t("noVenues")}</p>}
          <a
            href={placeSearchUrl(`${mapsQuery} ${cityLabel}`, evening.center.lat, evening.center.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <ExternalLink className="size-3" aria-hidden />
            {t("searchMapsVenues")}
          </a>
        </div>
      )}

      {style !== "none" && (
        <div>
          <p className="flex items-center gap-1 text-xs font-medium">
            <CalendarDays className="size-3.5" aria-hidden />
            {t("events", { date: format.dateTime(new Date(`${date}T12:00:00`), { day: "numeric", month: "short" }) })}
          </p>
          {evening.events.length > 0 ? (
            <ul className="mt-1 space-y-1">
              {evening.events.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.start.length > 10 && `${format.dateTime(new Date(e.start), { hour: "2-digit", minute: "2-digit" })} · `}
                    {e.venue && `${e.venue} · `}
                    {e.category}
                    {e.priceMin != null && e.currency && ` · ${t("price", { price: format.number(e.priceMin, { style: "currency", currency: e.currency, maximumFractionDigits: 0 }) })}`}
                  </span>
                  <a href={e.url} target="_blank" rel="noopener noreferrer sponsored" className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">
                    <Ticket className="size-3" aria-hidden />
                    {t("buy")}
                  </a>
                </li>
              ))}
              <li className="text-[11px] text-muted-foreground">{t("eventsSource", { source: evening.eventsSource ?? "" })}</li>
            </ul>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{evening.eventsSource ? t("noEvents") : t("eventsNeedKey")}</p>
          )}
          {evening.links.length > 0 && <AffiliateLinks links={evening.links} label={t("links")} size="xs" className="mt-1.5" about />}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">{tn("osmNote")}</p>
    </section>
  );
}

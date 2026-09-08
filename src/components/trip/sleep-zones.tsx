"use client";

import { useLocale, useTranslations } from "next-intl";
import { BedDouble, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AffiliateLinks } from "./affiliate-links";
import { useDistance } from "@/lib/units/use-distance";
import { placeLabel } from "@/lib/guest/plan-helpers";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";

type Props = {
  plan: GuestPlan;
  /** Called with the stay whose zones should be drawn on the map. */
  onShowMap: (stayId: string) => void;
  cityName: (slug: string) => string;
};

/**
 * "Where to sleep": up to three areas per stay, ranked by how close they are to
 * every day of that stay, each anchored to a visited place and carrying hotel
 * search links for that spot. Computed from the plan itself, never a specific
 * hotel recommendation.
 */
export function SleepZones({ plan, onShowMap, cityName }: Props) {
  const t = useTranslations("plan.sleep");
  const locale = useLocale() as Locale;
  const distance = useDistance();
  const stays = plan.extras?.links.sleepZones ?? [];
  if (stays.every((s) => s.zones.length === 0)) return null;
  return (
    <section className="rounded-md border bg-card p-4 text-sm" data-testid="sleep-zones" aria-labelledby="sleep-zones-title">
      <h3 id="sleep-zones-title" className="flex items-center gap-2 font-medium">
        <BedDouble className="size-4 text-sunset" aria-hidden />
        {t("title")}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
      {stays.map((s) => {
        const stay = plan.itinerary.stays.find((x) => x.id === s.stayId);
        if (!stay || s.zones.length === 0) return null;
        return (
          <div key={s.stayId} className="mt-3">
            {stays.length > 1 && <p className="text-xs font-medium">{cityName(stay.citySlug)}</p>}
            <ol className="mt-1 space-y-2">
              {s.zones.map((z, i) => {
                const anchor = plan.places[z.anchorPlaceId];
                return (
                  <li key={`${s.stayId}-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="numeral text-sunset">{i + 1}</span>
                    <span className="font-medium">{anchor ? t("near", { place: placeLabel(anchor, locale) }) : t("zone", { n: i + 1 })}</span>
                    <span className="text-xs text-muted-foreground">{t("stats", { distance: distance(z.avgKm), near: z.daysNear, days: z.days })}</span>
                    {z.links.length > 0 && <AffiliateLinks links={z.links} size="xs" />}
                  </li>
                );
              })}
            </ol>
            <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => onShowMap(s.stayId)}>
              <MapPinned aria-hidden />
              {t("showMap")}
            </Button>
          </div>
        );
      })}
    </section>
  );
}

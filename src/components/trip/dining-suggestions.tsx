"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import type { Venue } from "@/lib/nearby/schema";
import { placeSearchUrl } from "@/lib/trip/google-maps";
import { VenueList } from "./venue-list";

/**
 * Restaurants around a meal slot (milestone 11). The list comes from
 * OpenStreetMap near the previous stop; the Google Maps link searches the same
 * spot with reviews, for those who want ratings we cannot provide.
 */
export function DiningSuggestions({ venues, at, label }: { venues: Venue[] | undefined; at: { lat: number; lng: number } | null; label: string }) {
  const t = useTranslations("plan.nearby");
  const list = venues ?? [];
  if (list.length === 0 && !at) return null;
  return (
    <div className="mt-2 space-y-1.5" data-testid="dining">
      <p className="text-xs font-medium text-foreground">{t("dining")}</p>
      {list.length > 0 ? <VenueList venues={list} compact /> : <p className="text-xs text-muted-foreground">{t("noDining")}</p>}
      {at && (
        <a
          href={placeSearchUrl(`${t("mapsQuery")} ${label}`.trim(), at.lat, at.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="size-3" aria-hidden />
          {t("searchMaps")}
        </a>
      )}
      {list.length > 0 && <p className="text-[11px] text-muted-foreground">{t("osmNote")}</p>}
    </div>
  );
}

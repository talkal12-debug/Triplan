"use client";

import { useTranslations } from "next-intl";
import { Clock, ExternalLink, MapPin } from "lucide-react";
import type { Venue } from "@/lib/nearby/schema";
import { placeSearchUrl } from "@/lib/trip/google-maps";
import { useDistance } from "@/lib/units/use-distance";
import { cn } from "@/lib/utils";

/**
 * Real venues from OpenStreetMap: name, kind, cuisine, distance, opening hours
 * and website when OSM has them, plus a map link. Nothing is rated or invented;
 * the caption says where the data comes from.
 */
export function VenueList({ venues, className, compact = false }: { venues: Venue[]; className?: string; compact?: boolean }) {
  const t = useTranslations("plan.nearby");
  const distance = useDistance();
  if (venues.length === 0) return null;
  return (
    <ul className={cn("space-y-1.5", className)}>
      {venues.map((v) => (
        <li key={v.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <a
            href={placeSearchUrl(v.name, v.lat, v.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
            title={t("openMap")}
          >
            <MapPin className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {v.name}
          </a>
          <span className="text-xs text-muted-foreground">
            {t(`kinds.${v.kind}`)}
            {v.cuisine && ` · ${v.cuisine}`}
            {` · ${distance(v.distanceM / 1000)}`}
          </span>
          {!compact && v.openingHours && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" dir="ltr" title={t("hours")}>
              <Clock className="size-3" aria-hidden />
              {v.openingHours}
            </span>
          )}
          {!compact && v.hints.length > 0 && (
            <span className="text-xs text-muted-foreground">{v.hints.map((h) => t(`hints.${h}`)).join(" · ")}</span>
          )}
          {v.website && (
            <a href={v.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="size-3" aria-hidden />
              {t("website")}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

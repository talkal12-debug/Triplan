"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Bike, Bus, Car, CloudRain, Footprints, Hotel, Info, Lock, Utensils, Coffee } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Activity, Reason, Warning } from "@/lib/planner/itinerary";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

type Props = { plan: GuestPlan };

const transitIcons = { walk: Footprints, transit: Bus, car: Car, bike: Bike } as const;

function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Read-only rendering of a generated itinerary. Milestone 5 adds map, calendar and editing. */
export function PlanView({ plan }: Props) {
  const t = useTranslations("plan");
  const ti = useTranslations("wizard.interests.options");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const { itinerary, places, cities } = plan;
  const cityName = (slug: string) => {
    const c = cities.find((x) => x.slug === slug);
    return c ? (c.names[locale] ?? c.names.en) : slug;
  };

  const reasonText = (r: Reason): string => {
    const params = { ...r.params } as Record<string, string | number>;
    if (r.code === "interest_match" && typeof params.interest === "string") params.interest = ti(params.interest as never);
    if (r.code === "open_on_day" && typeof params.weekday === "string") params.weekday = t(`weekdays.${params.weekday}` as never);
    if (r.code === "day_trip" && typeof params.city === "string") params.city = cityName(params.city);
    return t(`reasons.${r.code}`, params);
  };
  const warningText = (w: Warning): string => {
    const params = { ...w.params } as Record<string, string | number>;
    if (typeof params.city === "string") params.city = cityName(params.city);
    if (typeof params.base === "string") params.base = cityName(params.base);
    return t(`warnings.${w.code}`, params);
  };
  const placeName = (id: string) => {
    const p = places[id];
    if (!p) return id;
    const localized = p.names[locale] ?? p.names.en;
    return localized === p.nameLocal ? localized : `${localized} / ${p.nameLocal}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-4 text-sm">
        <p className="font-medium">
          {t("tripStats", {
            km: itinerary.stats.totalWalkKm,
            places: itinerary.stats.places,
            verified: Math.round(itinerary.stats.verifiedShare * 100),
          })}
        </p>
        <p className="mt-1 text-muted-foreground">{t("generatedNote")}</p>
        <p className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t(`baseMode.${itinerary.baseMode}`)}</Badge>
          {itinerary.stays.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 text-muted-foreground">
              <Hotel className="size-3.5" aria-hidden />
              {t("stayLabel", { city: cityName(s.citySlug), from: s.fromDay + 1, to: s.toDay + 1 })}
            </span>
          ))}
        </p>
        {itinerary.warnings.filter((w) => w.dayIndex === undefined).length > 0 && (
          <ul className="mt-3 space-y-1">
            {itinerary.warnings
              .filter((w) => w.dayIndex === undefined)
              .map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {warningText(w)}
                </li>
              ))}
          </ul>
        )}
      </div>

      <ol className="space-y-6">
        {itinerary.days.map((day) => {
          const date = new Date(`${day.date}T00:00:00`);
          const dayWarnings = [...day.warnings, ...itinerary.warnings.filter((w) => w.dayIndex === day.index)].filter(
            (w) => w.code !== "unverified_data" && w.code !== "advance_booking_needed",
          );
          const visits = day.activities.filter((a) => a.kind === "visit").length;
          return (
            <li key={day.index} className="rounded-2xl border bg-card">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {t("dayTitle", { n: day.index + 1 })}
                    <span className="ms-2 text-base font-normal text-muted-foreground">
                      {format.dateTime(date, { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {cityName(day.citySlug)}
                    {day.kind !== "full" && ` · ${t(`kinds.${day.kind}`)}`}
                    {day.theme && ` · ${t(`themes.${day.theme}` as never)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={day.stats.intensity === "heavy" ? "default" : "secondary"}>{t(`intensity.${day.stats.intensity}`)}</Badge>
                  <span className="text-muted-foreground">{t("walk", { km: day.stats.walkKm })}</span>
                  <span className="text-muted-foreground">{t("placesCount", { count: visits })}</span>
                </div>
              </header>

              {dayWarnings.length > 0 && (
                <ul className="space-y-1 border-b bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {dayWarnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {warningText(w)}
                      {w.placeId && <span className="text-muted-foreground">({placeName(w.placeId)})</span>}
                    </li>
                  ))}
                </ul>
              )}

              {visits === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">{t("emptyDay")}</p>
              ) : (
                <ol className="divide-y">
                  {day.activities.map((a) => (
                    <ActivityRow key={a.id} activity={a} placeName={placeName} reasonText={reasonText} places={places} />
                  ))}
                </ol>
              )}

              {day.rainPlan.length > 0 && (
                <p className="flex items-start gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
                  <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="font-medium text-foreground">{t("rainPlan")}: </span>
                    {day.rainPlan.map(placeName).join(" · ")}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ActivityRow({
  activity: a,
  placeName,
  reasonText,
  places,
}: {
  activity: Activity;
  placeName: (id: string) => string;
  reasonText: (r: Reason) => string;
  places: GuestPlan["places"];
}) {
  const t = useTranslations("plan");
  const place = a.placeId ? places[a.placeId] : undefined;
  const Transit = a.transitFromPrev ? transitIcons[a.transitFromPrev.mode] : null;
  const isVisit = a.kind === "visit";
  const Icon = a.kind === "meal" ? Utensils : a.kind === "rest" ? Coffee : Hotel;

  return (
    <li className="px-4 py-3">
      {a.transitFromPrev && Transit && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Transit className="size-3.5" aria-hidden />
          {t(`transit.${a.transitFromPrev.mode}`, { minutes: a.transitFromPrev.minutes })}
          {a.transitFromPrev.estimated && <span>({t("estimated")})</span>}
        </p>
      )}
      <div className="flex gap-3">
        <time className="w-24 shrink-0 pt-0.5 text-sm tabular-nums text-muted-foreground" dir="ltr">
          {hhmm(a.startMin)}–{hhmm(a.endMin)}
        </time>
        <div className="min-w-0 flex-1">
          <p className={cn("flex flex-wrap items-center gap-2 font-medium", !isVisit && "text-muted-foreground")}>
            {!isVisit && <Icon className="size-4" aria-hidden />}
            {isVisit && a.placeId ? placeName(a.placeId) : t(`activity.${a.kind}` as never)}
            {a.locked && <Lock className="size-3.5 text-muted-foreground" aria-hidden />}
            {a.dataQuality && a.dataQuality !== "verified" && (
              <Badge variant="outline" className="text-[10px]">
                {t(`dataQuality.${a.dataQuality}`)}
              </Badge>
            )}
          </p>
          {isVisit && a.reasons.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {a.reasons.slice(0, 4).map((r, i) => (
                <li key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {reasonText(r)}
                </li>
              ))}
            </ul>
          )}
          {isVisit && place?.website && (
            <a href={place.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline">
              {t("website")}
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

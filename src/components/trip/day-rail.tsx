"use client";

import { useEffect, useRef } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { Itinerary } from "@/lib/planner/itinerary";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";
import { cityLabel, localDateOf } from "@/lib/guest/plan-helpers";
import { cn } from "@/lib/utils";
import { WeatherBadge } from "./weather-badge";

type Props = {
  plan: GuestPlan;
  dayIndex: number;
  onSelect: (index: number) => void;
};

const intensityDot: Record<Itinerary["days"][number]["stats"]["intensity"], string> = {
  light: "bg-emerald-500",
  moderate: "bg-amber-500",
  heavy: "bg-rose-500",
};

/** Horizontally scrolling day chips (the "day cards" on a phone). */
export function DayRail({ plan, dayIndex, onSelect }: Props) {
  const t = useTranslations("plan");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-day="${dayIndex}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [dayIndex]);

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={t("daysLabel")}
      className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {plan.itinerary.days.map((day) => {
        const selected = day.index === dayIndex;
        return (
          <button
            key={day.index}
            type="button"
            role="tab"
            aria-selected={selected}
            data-day={day.index}
            onClick={() => onSelect(day.index)}
            className={cn(
              "flex min-w-32 shrink-0 snap-center flex-col items-start rounded-md border-2 px-3 py-2 text-start transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
            )}
          >
            <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
              {t("dayShort", { n: day.index + 1 })}
              <span className="flex items-center gap-1">
                <WeatherBadge weather={plan.extras?.weather[day.date]} compact />
                <span className={cn("size-2 rounded-full", intensityDot[day.stats.intensity])} aria-label={t(`intensity.${day.stats.intensity}`)} />
              </span>
            </span>
            <span className="font-semibold">{format.dateTime(localDateOf(day.date), { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="truncate text-xs text-muted-foreground">{cityLabel(plan, day.citySlug, locale)}</span>
          </button>
        );
      })}
    </div>
  );
}

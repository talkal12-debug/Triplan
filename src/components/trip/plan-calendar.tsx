"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";
import { cityLabel } from "@/lib/guest/plan-helpers";
import { cn } from "@/lib/utils";

type Props = { plan: GuestPlan; dayIndex: number; onSelect: (index: number) => void };

const intensityBg = { light: "bg-emerald-500/15", moderate: "bg-amber-500/15", heavy: "bg-rose-500/15" } as const;

/** Month grid(s) spanning the trip. Only trip days are interactive. */
export function PlanCalendar({ plan, dayIndex, onSelect }: Props) {
  const t = useTranslations("plan");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const days = plan.itinerary.days;
  const byDate = new Map(days.map((d) => [d.date, d]));
  // Calendar days are destination days: all the arithmetic is in UTC so nothing shifts with the viewer's zone.
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const last = new Date(`${days[days.length - 1].date}T00:00:00Z`);

  // Week starts on Sunday for Hebrew, Monday otherwise.
  const weekStart = locale === "he" ? 0 : 1;
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 6 + ((i + weekStart) % 7))); // 2026-09-06 is a Sunday
    return format.dateTime(d, { weekday: "short", timeZone: "UTC" });
  });

  const months: { year: number; month: number }[] = [];
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth(); y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth()); ) {
    months.push({ year: y, month: m });
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t("calendar.legend")}</p>
      {months.map(({ year, month }) => {
        const start = new Date(Date.UTC(year, month, 1));
        const lead = (start.getUTCDay() - weekStart + 7) % 7;
        const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const cells: (Date | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, month, i + 1)))];
        return (
          <section key={`${year}-${month}`} aria-label={format.dateTime(start, { month: "long", year: "numeric", timeZone: "UTC" })}>
            <h3 className="mb-2 font-semibold">{format.dateTime(start, { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {weekdayLabels.map((w) => (
                <div key={w} className="py-1">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} />;
                const iso = d.toISOString().slice(0, 10);
                const day = byDate.get(iso);
                if (!day) {
                  return (
                    <div key={iso} className="min-h-14 rounded-lg p-1 text-xs text-muted-foreground/60">
                      {d.getUTCDate()}
                    </div>
                  );
                }
                const selected = day.index === dayIndex;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onSelect(day.index)}
                    aria-current={selected ? "date" : undefined}
                    className={cn(
                      "flex min-h-14 flex-col items-start rounded-lg border-2 p-1 text-start text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      intensityBg[day.stats.intensity],
                      selected ? "border-primary" : "border-transparent hover:border-primary/40",
                    )}
                  >
                    <span className="font-semibold">{d.getUTCDate()}</span>
                    <span className="truncate text-[10px] text-muted-foreground">{cityLabel(plan, day.citySlug, locale)}</span>
                    {day.theme && <span className="truncate text-[10px]">{t(`themes.${day.theme}` as never)}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

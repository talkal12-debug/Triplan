"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { updateGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import { buildChecklist } from "@/lib/trip/checklist";
import { localDateOf, placeLabel, todayIso } from "@/lib/guest/plan-helpers";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

type Props = { trip: GuestTrip; onTripChange: (trip: GuestTrip) => void };

export function ChecklistPanel({ trip, onTripChange }: Props) {
  const t = useTranslations("tools.checklist");
  const tItem = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const items = buildChecklist(trip.preferences, trip.plan, (id) => placeLabel(trip.plan?.places[id], locale, id));
  const ticked = trip.checklist ?? {};
  const today = todayIso();
  const key = (i: (typeof items)[number]) => `${i.id}:${i.params?.place ?? i.params?.name ?? ""}`;
  const done = items.filter((i) => ticked[key(i)]).length;

  function toggle(k: string) {
    const next = { ...ticked, [k]: !ticked[k] };
    const updated = updateGuestTrip(trip.id, { checklist: next }) ?? { ...trip, checklist: next };
    onTripChange(updated);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <p className="text-sm font-medium" aria-live="polite">
        {t("progress", { done, total: items.length })}
      </p>
      <ul className="space-y-1">
        {items.map((i) => {
          const k = key(i);
          const isDone = Boolean(ticked[k]);
          const overdue = !isDone && i.due < today;
          const params = { ...(i.params ?? {}) } as Record<string, string | number>;
          if (typeof params.date === "string") params.date = format.dateTime(localDateOf(params.date), { day: "numeric", month: "short" });
          if (typeof params.until === "string") params.until = format.dateTime(localDateOf(params.until), { dateStyle: "medium" });
          return (
            <li key={k}>
              <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border bg-card px-3 py-2 hover:bg-muted", isDone && "opacity-60")}>
                <input type="checkbox" checked={isDone} onChange={() => toggle(k)} className="mt-1 size-5 accent-primary" />
                <span className="min-w-0 flex-1">
                  <span className={cn("block", isDone && "line-through")}>{tItem(`items.${i.id}`, params)}</span>
                  <span className={cn("mt-0.5 flex items-center gap-1 text-xs", overdue ? "text-destructive" : "text-muted-foreground")}>
                    {i.severity === "warning" && !isDone && <AlertTriangle className="size-3" aria-hidden />}
                    {t("due", { date: format.dateTime(localDateOf(i.due), { day: "numeric", month: "short", year: "numeric" }) })}
                    {overdue && ` · ${t("overdue")}`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

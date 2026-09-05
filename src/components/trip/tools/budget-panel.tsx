"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Info } from "lucide-react";
import type { GuestTrip } from "@/lib/guest/trips";
import { estimateBudget } from "@/lib/trip/budget";

export function BudgetPanel({ trip }: { trip: GuestTrip }) {
  const t = useTranslations("tools.budget");
  const tp = useTranslations("plan");
  const format = useFormatter();
  if (!trip.plan) return <p className="text-sm text-muted-foreground">{tp("build")}</p>;
  const rates = trip.plan.extras?.rates;
  const quote = rates ? Object.keys(rates.rates)[0] : undefined;
  const rate = rates && quote ? { quote, value: rates.rates[quote] } : null;
  const budget = estimateBudget(trip.preferences, trip.plan.itinerary, trip.plan.places, rate);
  const money = (n: number) => format.number(n, { style: "currency", currency: budget.currency, maximumFractionDigits: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label={t("perPersonPerDay")} value={money(budget.perPersonPerDay)} big />
        <Stat label={t("perPersonTotal")} value={money(budget.perPersonTotal)} />
        <Stat label={t("groupTotal", { people: budget.people, nights: budget.nights })} value={money(budget.groupTotal)} />
      </div>
      {budget.capRatio !== null && (
        <p className={budget.capRatio <= 1 ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-amber-700 dark:text-amber-400"}>
          {budget.capRatio <= 1 ? t("capOk") : t("capOver", { ratio: budget.capRatio.toFixed(1) })}
        </p>
      )}
      {!budget.converted && <p className="text-xs text-muted-foreground">{t("inEur")}</p>}
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 text-start font-medium"></th>
            <th className="py-1 text-end font-medium">{t("perDay")}</th>
            <th className="py-1 text-end font-medium">{t("total")}</th>
          </tr>
        </thead>
        <tbody>
          {budget.lines.map((l) => (
            <tr key={l.key} className="border-t">
              <td className="py-2">{t(`lines.${l.key}`)}</td>
              <td className="py-2 text-end tabular-nums">{money(l.perDay)}</td>
              <td className="py-2 text-end tabular-nums">{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t("disclaimer")}
      </p>
    </div>
  );
}

function Stat({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={big ? "mt-1 text-2xl font-bold tabular-nums" : "mt-1 text-lg font-semibold tabular-nums"}>{value}</p>
    </div>
  );
}

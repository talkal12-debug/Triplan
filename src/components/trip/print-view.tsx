"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import { hhmm, localDateOf, placeLabel, placeSummary } from "@/lib/guest/plan-helpers";
import type { Locale } from "@/lib/i18n/locales";
import type { WizardContext } from "@/components/wizard/step-props";
import { useDistance } from "@/lib/units/use-distance";
import { usePlanText } from "./use-plan-text";

type Props = { id: string; ctx: WizardContext };

/** Print-friendly plan: one page per day, local names for taxi drivers, no interactive chrome. */
export function PrintView({ id, ctx }: Props) {
  const t = useTranslations("print");
  const [trip, setTrip] = useState<GuestTrip | null | undefined>(undefined);
  useEffect(() => {
    setTrip(getGuestTrip(id) ?? null);
  }, [id]);
  if (trip === undefined) return null;
  if (!trip?.plan) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Button asChild variant="outline">
          <Link href={`/trip/${id}`}>{t("back")}</Link>
        </Button>
      </div>
    );
  }
  return <PrintContent trip={trip as GuestTrip & { plan: NonNullable<GuestTrip["plan"]> }} ctx={ctx} />;
}

function PrintContent({ trip, ctx }: { trip: GuestTrip & { plan: NonNullable<GuestTrip["plan"]> }; ctx: WizardContext }) {
  const t = useTranslations("print");
  const tp = useTranslations("plan");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const distance = useDistance();
  const plan = trip.plan;
  const { reasonText, city } = usePlanText(plan);
  const title = trip.preferences.destinations.map((d) => ctx.countries.find((c) => c.code === d.countryCode)?.name ?? d.countryCode).join(" · ");

  return (
    <div className="print-root mx-auto max-w-3xl px-4 py-8">
      <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{t("tip")}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/trip/${trip.id}`}>{t("back")}</Link>
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("print")}
          </Button>
        </div>
      </div>

      <header className="border-b pb-4">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-muted-foreground">
          {t("subtitle", { days: plan.itinerary.days.length, places: plan.itinerary.stats.places, distance: distance(plan.itinerary.stats.totalWalkKm) })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {plan.itinerary.stays.map((s) => tp("stayLabel", { city: city(s.citySlug), from: s.fromDay + 1, to: s.toDay + 1 })).join(" · ")}
        </p>
      </header>

      {plan.itinerary.days.map((day) => (
        <section key={day.index} className="print-day mt-8 break-inside-avoid">
          <h2 className="text-xl font-semibold">
            {tp("dayTitle", { n: day.index + 1 })} · {format.dateTime(localDateOf(day.date), { weekday: "long", day: "numeric", month: "long" })}
            <span className="ms-2 text-base font-normal text-muted-foreground">
              {city(day.citySlug)} · {tp("walk", { distance: distance(day.stats.walkKm) })}
            </span>
          </h2>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {day.activities.map((a) => {
                const p = a.placeId ? plan.places[a.placeId] : undefined;
                return (
                  <tr key={a.id} className="border-t align-top">
                    <td className="w-24 py-2 tabular-nums text-muted-foreground" dir="ltr">
                      {hhmm(a.startMin)}–{hhmm(a.endMin)}
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{a.kind === "visit" ? placeLabel(p, locale, a.placeId ?? "") : tp(`activity.${a.kind}` as never)}</div>
                      {a.kind === "visit" && placeSummary(p, locale) && <div className="text-xs text-muted-foreground" dir="auto">{placeSummary(p, locale)?.text}</div>}
                      {p && (
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {p.nameLocal} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                          {p.openingHours ? ` · ${p.openingHours}` : ""}
                        </div>
                      )}
                      {a.transitFromPrev && <div className="text-xs text-muted-foreground">{tp(`transit.${a.transitFromPrev.mode}`, { minutes: a.transitFromPrev.minutes })}</div>}
                      {a.kind === "visit" && a.reasons.length > 0 && <div className="text-xs text-muted-foreground">{a.reasons.slice(0, 2).map(reasonText).join(" · ")}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {day.rainPlan.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {tp("rainPlan")}: {day.rainPlan.map((id) => placeLabel(plan.places[id], locale, id)).join(" · ")}
            </p>
          )}
        </section>
      ))}

      <footer className="mt-10 border-t pt-3 text-xs text-muted-foreground">{t("generated")} · {new Date().toLocaleDateString(locale)}</footer>
    </div>
  );
}

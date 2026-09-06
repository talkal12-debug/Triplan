"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CountryFlag } from "@/components/country-flag";
import { recommendBaseMode, tripEndDate, type TripPreferences } from "@/lib/planner/types";
import type { WizardStep } from "@/lib/wizard/steps";
import type { WizardContext } from "./step-props";

type Props = {
  prefs: TripPreferences;
  ctx: WizardContext;
  /** When true, every section links to its wizard step. */
  editable?: boolean;
};

export function PreferencesSummary({ prefs, ctx, editable = false }: Props) {
  const t = useTranslations("wizard");
  const ts = useTranslations("wizard.summary");
  const format = useFormatter();

  const countryByCode = new Map(ctx.countries.map((c) => [c.code, c]));
  const listFormat = new Intl.ListFormat(ctx.locale, { style: "long", type: "conjunction" });

  const transportModes = (Object.entries(prefs.transport) as [keyof typeof prefs.transport, number][])
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => t(`transport.modes.${m}`));

  const partyParts = [
    ts("people", { count: prefs.party.adults }),
    prefs.party.seniors > 0 ? ts("seniorsCount", { count: prefs.party.seniors }) : null,
    prefs.party.childrenAges.length > 0
      ? `${ts("childrenCount", { count: prefs.party.childrenAges.length })} (${prefs.party.childrenAges.join(", ")})`
      : null,
    prefs.party.infants > 0 ? ts("infantsCount", { count: prefs.party.infants }) : null,
    prefs.party.stroller ? ts("stroller") : null,
  ].filter((p): p is string => Boolean(p));

  const baseMode = prefs.hotel.baseMode === "auto" ? recommendBaseMode(prefs).mode : prefs.hotel.baseMode;
  const start = new Date(`${prefs.dates.start}T00:00:00`);
  const end = new Date(`${tripEndDate(prefs.dates)}T00:00:00`);

  const sections: { step: WizardStep; content: React.ReactNode }[] = [
    {
      step: "destination",
      content: (
        <ul className="space-y-1">
          {prefs.destinations.map((d) => {
            const c = countryByCode.get(d.countryCode);
            const custom = (d.customCities ?? []).map((city) => ({ slug: city.slug, name: city.names[ctx.locale] ?? city.names.en }));
            const cities = [...(ctx.cities[d.countryCode] ?? []), ...custom].filter((city) => d.cities.includes(city.slug));
            return (
              <li key={d.countryCode} className="flex items-center gap-2">
                <CountryFlag code={d.countryCode} size={20} />
                <span className="font-medium">{c?.name ?? d.countryCode}</span>
                <span className="text-sm text-muted-foreground">
                  {cities.length ? listFormat.format(cities.map((x) => x.name)) : ts("noCities")}
                </span>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      step: "dates",
      content: (
        <>
          {ts("days", { count: prefs.dates.days, date: format.dateTime(start, { dateStyle: "medium" }) })}
          <span className="text-muted-foreground"> · {format.dateTime(end, { dateStyle: "medium" })}</span>
        </>
      ),
    },
    { step: "party", content: listFormat.format(partyParts) },
    { step: "visit", content: ts(`visit.${prefs.visitNumber}`) },
    {
      step: "pace",
      content: (
        <>
          {t(`pace.options.${prefs.effort}.title`)}
          {prefs.accessibility.length > 0 && (
            <span className="text-muted-foreground">
              {" · "}
              {listFormat.format(prefs.accessibility.map((a) => t(`pace.accessibilityOptions.${a}`)))}
            </span>
          )}
        </>
      ),
    },
    { step: "wishlist", content: prefs.mustVisit.length ? listFormat.format(prefs.mustVisit.map((m) => m.name)) : ts("none") },
    { step: "transport", content: transportModes.length ? listFormat.format(transportModes) : ts("none") },
    {
      step: "interests",
      content: (
        <>
          {prefs.interests.length
            ? prefs.interests.map((i, k) => (
                <span key={i} className={k < 3 ? "font-medium" : "text-muted-foreground"}>
                  {k > 0 && ", "}
                  {t(`interests.options.${i}`)}
                </span>
              ))
            : ts("none")}
          <span className="block text-sm text-muted-foreground">
            {t("interests.evening.title")}: {t(`interests.evening.options.${prefs.evening}.title`)}
          </span>
        </>
      ),
    },
    {
      step: "budget",
      content: (
        <>
          {t(`budget.levels.${prefs.budget.level}.title`)}
          <span className="text-muted-foreground">
            {" · "}
            {prefs.budget.dailyCap
              ? ts("capValue", { amount: format.number(prefs.budget.dailyCap, { style: "currency", currency: prefs.budget.currency, maximumFractionDigits: 0 }) })
              : ts("noCap")}
          </span>
        </>
      ),
    },
    {
      step: "hotel",
      content: listFormat.format([
        t(`hotel.types.${prefs.hotel.type}`),
        t(`hotel.locations.${prefs.hotel.locationPref}`),
        t(`hotel.baseModes.${baseMode}.title`),
      ]),
    },
  ];

  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {sections.map(({ step, content }) => (
        <div key={step} className="rounded-md border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-sm text-muted-foreground">{t(`steps.${step}`)}</dt>
            {editable && (
              <Link
                href={`/plan/${step}`}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-primary hover:bg-muted"
                aria-label={`${t("edit")}: ${t(`steps.${step}`)}`}
              >
                <Pencil className="size-3.5" aria-hidden />
                {t("edit")}
              </Link>
            )}
          </div>
          <dd className="mt-1">{content}</dd>
        </div>
      ))}
    </dl>
  );
}

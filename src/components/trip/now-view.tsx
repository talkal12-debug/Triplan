"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ArrowLeft, MapPinOff, Navigation } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import type { Activity } from "@/lib/planner/itinerary";
import { googleMapsDirections, hhmm, localDateOf, googleTranslateUrl, placeSummary, todayIso } from "@/lib/guest/plan-helpers";
import { usePlanText } from "./use-plan-text";
import { cn } from "@/lib/utils";

type Props = { id: string };

/** "My day": what is happening now and next, with big buttons, for the phone in the field. */
export function NowView({ id }: Props) {
  const t = useTranslations("plan");
  const tt = useTranslations("trip");
  const [trip, setTrip] = useState<GuestTrip | null | undefined>(undefined);
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [nowMin, setNowMin] = useState(() => new Date().getHours() * 60 + new Date().getMinutes());

  useEffect(() => {
    const found = getGuestTrip(id) ?? null;
    setTrip(found);
    if (found?.plan) {
      const today = todayIso();
      const idx = found.plan.itinerary.days.findIndex((d) => d.date === today);
      setDayIndex(idx >= 0 ? idx : null);
    }
    const timer = setInterval(() => setNowMin(new Date().getHours() * 60 + new Date().getMinutes()), 30_000);
    return () => clearInterval(timer);
  }, [id]);

  if (trip === undefined) {
    return (
      <div className="mx-auto w-full max-w-md space-y-3 px-4 py-10" aria-busy>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full rounded-md" />
      </div>
    );
  }
  if (!trip?.plan) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center">
        <MapPinOff className="size-10 text-muted-foreground" aria-hidden />
        <p className="mt-4 text-muted-foreground">{tt("notFoundBody")}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={`/trip/${id}`}>{t("now.backToPlan")}</Link>
        </Button>
      </div>
    );
  }

  return <NowContent trip={trip as GuestTrip & { plan: NonNullable<GuestTrip["plan"]> }} dayIndex={dayIndex} setDayIndex={setDayIndex} nowMin={nowMin} />;
}

function NowContent({
  trip,
  dayIndex,
  setDayIndex,
  nowMin,
}: {
  trip: GuestTrip & { plan: NonNullable<GuestTrip["plan"]> };
  dayIndex: number | null;
  setDayIndex: (i: number) => void;
  nowMin: number;
}) {
  const t = useTranslations("plan");
  const format = useFormatter();
  const plan = trip.plan;
  const { name, city, reasonText } = usePlanText(plan);
  const day = dayIndex !== null ? plan.itinerary.days[dayIndex] : null;

  let current: Activity | null = null;
  let next: Activity | null = null;
  let later: Activity[] = [];
  if (day) {
    const acts = day.activities;
    current = acts.find((a) => a.startMin <= nowMin && a.endMin > nowMin) ?? null;
    const upcoming = acts.filter((a) => a.startMin > nowMin);
    next = upcoming[0] ?? null;
    later = upcoming.slice(1, 4);
  }
  const finished = day ? day.activities.every((a) => a.endMin <= nowMin) : false;
  const notStarted = day ? day.activities.every((a) => a.startMin > nowMin) : false;

  const place = (a: Activity | null) => (a?.placeId ? plan.places[a.placeId] : undefined);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("now.title")}</h1>
        <Link href={`/trip/${trip.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t("now.backToPlan")}
        </Link>
      </div>

      {dayIndex === null && (
        <div className="mt-6">
          <p className="text-sm text-muted-foreground">{t("now.noTripToday")}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {plan.itinerary.days.map((d) => (
              <Button key={d.index} type="button" variant="outline" className="h-12 justify-start" onClick={() => setDayIndex(d.index)}>
                {t("dayShort", { n: d.index + 1 })} · {format.dateTime(localDateOf(d.date), { day: "numeric", month: "short" })}
              </Button>
            ))}
          </div>
        </div>
      )}

      {day && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            {format.dateTime(localDateOf(day.date), { weekday: "long", day: "numeric", month: "long" })} · {city(day.citySlug)}
          </p>

          {finished && <p className="rounded-md border border-dashed p-6 text-center">{t("now.done")}</p>}

          {current && <BigCard label={t("now.current")} activity={current} name={name(current.placeId) || t(`activity.${current.kind}` as never)} sub={t("now.endsAt", { time: hhmm(current.endMin) })} place={place(current)} primary reasonText={reasonText} />}

          {!current && !finished && next && (
            <p className="text-sm text-muted-foreground">
              {notStarted ? t("now.notStarted") : t("now.free", { time: hhmm(next.startMin) })}
            </p>
          )}

          {next && (
            <BigCard
              label={t("now.next")}
              activity={next}
              name={name(next.placeId) || t(`activity.${next.kind}` as never)}
              sub={next.startMin > nowMin ? t("now.startsIn", { minutes: next.startMin - nowMin }) : ""}
              place={place(next)}
              primary={!current}
              reasonText={reasonText}
            />
          )}

          {!next && !finished && current && <p className="text-sm text-muted-foreground">{t("now.nothingLeft")}</p>}

          {later.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t("now.later")}</h2>
              <ul className="space-y-1 text-sm">
                {later.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <time className="w-12 tabular-nums text-muted-foreground" dir="ltr">
                      {hhmm(a.startMin)}
                    </time>
                    {name(a.placeId) || t(`activity.${a.kind}` as never)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function BigCard({
  label,
  activity,
  name,
  sub,
  place,
  primary,
  reasonText,
}: {
  label: string;
  activity: Activity;
  name: string;
  sub: string;
  place: NonNullable<GuestTrip["plan"]>["places"][string] | undefined;
  primary: boolean;
  reasonText: ReturnType<typeof usePlanText>["reasonText"];
}) {
  const locale = useLocale();
  const summary = placeSummary(place, locale);
  const t = useTranslations("plan");
  return (
    <section className={cn("rounded-lg border-2 p-5", primary ? "border-primary bg-primary/5" : "border-border bg-card")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-tight">{name}</p>
      <p className="mt-1 text-sm text-muted-foreground" dir="auto">
        <span dir="ltr">{hhmm(activity.startMin)}–{hhmm(activity.endMin)}</span>
        {sub && ` · ${sub}`}
      </p>
      {summary && (
        <p className="mt-2 text-sm text-muted-foreground" dir="auto">
          {summary.text}
          {summary.lang !== locale && (
            <>
              {" "}
              <a href={googleTranslateUrl(summary.text, summary.lang, locale)} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-xs underline-offset-2 hover:underline">
                {t("summaryGoogle")}
              </a>
            </>
          )}
        </p>
      )}
      {activity.reasons.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{activity.reasons.slice(0, 2).map(reasonText).join(" · ")}</p>
      )}
      {place && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild className="h-12 flex-1">
            <a href={googleMapsDirections(place.lat, place.lng)} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden />
              {t("now.navigate")}
            </a>
          </Button>
        </div>
      )}
    </section>
  );
}

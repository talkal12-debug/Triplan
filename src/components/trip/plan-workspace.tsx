"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, CalendarDays, List, Map as MapIcon, Navigation, Undo2, Rows3 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { GuestTrip, GuestPlan } from "@/lib/guest/trips";
import { applyEdit } from "@/lib/guest/plan-edits";
import type { EditOp } from "@/lib/planner/edit-ops";
import type { PlaceSeed } from "@/lib/data/schemas";
import { DayRail } from "./day-rail";
import { DayTimeline } from "./day-timeline";
import { PlanMap } from "./plan-map";
import { PlanCalendar } from "./plan-calendar";
import { PlanList } from "./plan-list";
import { SwapSheet } from "./swap-sheet";
import { usePlanText } from "./use-plan-text";
import { AffiliateAbout, AffiliateLinks } from "./affiliate-links";
import { SeasonalHighlights } from "./seasonal-highlights";
import { EventsHighlights } from "./events-highlights";
import { seniorText } from "@/lib/data/senior-discounts";
import { useDistance } from "@/lib/units/use-distance";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { updateGuestTrip } from "@/lib/guest/trips";
import { placeLabel } from "@/lib/guest/plan-helpers";
import { markVisited } from "@/lib/profile/client";
import type { Locale } from "@/lib/i18n/locales";

type View = "timeline" | "map" | "calendar" | "list";
const views: { id: View; icon: typeof List }[] = [
  { id: "timeline", icon: Rows3 },
  { id: "map", icon: MapIcon },
  { id: "calendar", icon: CalendarDays },
  { id: "list", icon: List },
];

type Props = {
  trip: GuestTrip & { plan: GuestPlan };
  onTripChange: (trip: GuestTrip) => void;
  /** Shared view without edit permission: no actions, no drag. */
  readOnly?: boolean;
  /** Where the "my day" button points; omitted in shared views. */
  nowHref?: string;
};

export function PlanWorkspace({ trip, onTripChange, readOnly = false, nowHref }: Props) {
  const t = useTranslations("plan");
  const plan = trip.plan;
  const { name, city, warningText } = usePlanText(plan);
  const distance = useDistance();
  const { data: session } = useSession();
  const locale = useLocale() as Locale;
  const [view, setView] = useState<View>("timeline");
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<GuestPlan | null>(null);
  const [swap, setSwap] = useState<{ dayIndex: number; activityId: string; alternatives: PlaceSeed[] | null } | null>(null);

  useEffect(() => {
    if (dayIndex >= plan.itinerary.days.length) setDayIndex(0);
  }, [plan.itinerary.days.length, dayIndex]);

  const run = useCallback(
    async (op: EditOp) => {
      setBusy(true);
      setError(null);
      try {
        const result = await applyEdit(trip, op);
        if (op.type === "alternatives") return result.alternatives;
        if (JSON.stringify(result.trip.plan?.itinerary.days) === JSON.stringify(plan.itinerary.days)) {
          // Nothing fitted (or nothing left to drop): tell the traveller instead of looking stuck.
          setError(t("editNoChange"));
          return [];
        }
        setUndo(plan);
        onTripChange(result.trip);
        setSelectedId(null);
        return [];
      } catch (err) {
        setError(t("editError", { message: (err as Error).message }));
        return [];
      } finally {
        setBusy(false);
      }
    },
    [trip, plan, onTripChange, t],
  );

  const activityDay = (activityId: string) => plan.itinerary.days.find((d) => d.activities.some((a) => a.id === activityId))?.index ?? dayIndex;

  const allActions = {
    onSwap: async (activityId: string) => {
      const d = activityDay(activityId);
      setSwap({ dayIndex: d, activityId, alternatives: null });
      const alternatives = await run({ type: "alternatives", dayIndex: d, activityId });
      setSwap((s) => (s && s.activityId === activityId ? { ...s, alternatives } : s));
    },
    onLock: (activityId: string) => void run({ type: "lock", dayIndex: activityDay(activityId), activityId }),
    onRemove: (activityId: string) => void run({ type: "remove", dayIndex: activityDay(activityId), activityId }),
    onVisited: async (activityId: string) => {
      const d = activityDay(activityId);
      const activity = plan.itinerary.days[d]?.activities.find((a) => a.id === activityId);
      const place = activity?.placeId ? plan.places[activity.placeId] : undefined;
      if (!place) return;
      await run({ type: "remove", dayIndex: d, activityId });
      // Remember it for this trip's preferences (rebuilds skip it) and in the profile (future trips skip it).
      const alreadySeen = Array.from(new Set([...trip.preferences.alreadySeen, place.id]));
      const updated = updateGuestTrip(trip.id, { preferences: { ...trip.preferences, alreadySeen } });
      if (updated) onTripChange(updated);
      void markVisited(place, placeLabel(place, locale, place.id), Boolean(session?.user));
    },
    onMove: (activityId: string, toDay: number) => void run({ type: "move", fromDay: activityDay(activityId), activityId, toDay }),
    onMoveTo: (fromDay: number, activityId: string, toDay: number, position: number) => void run({ type: "move", fromDay, activityId, toDay, position }),
    onReorder: (d: number, placeIds: string[]) => void run({ type: "reorder", dayIndex: d, placeIds }),
    onRebalance: (d: number, direction: "lighter" | "heavier") => void run({ type: "rebalance", dayIndex: d, direction }),
    onRebuild: (d: number) => void run({ type: "rebuild", dayIndex: d }),
  };
  const actions = readOnly ? undefined : allActions;

  function undoLast() {
    if (!undo) return;
    onTripChange({ ...trip, plan: undo });
    setUndo(null);
  }

  const swapActivity = swap ? plan.itinerary.days[swap.dayIndex]?.activities.find((a) => a.id === swap.activityId) : undefined;
  const tripWarnings = plan.itinerary.warnings.filter((w) => w.dayIndex === undefined);

  return (
    <div className="space-y-4">
      {plan.extras?.seasonal && plan.extras.seasonal.length > 0 && <SeasonalHighlights items={plan.extras.seasonal} />}
      <EventsHighlights plan={plan} />
      <div className="rounded-2xl border bg-card p-4 text-sm">
        <p className="font-medium">
          {t("tripStats", { distance: distance(plan.itinerary.stats.totalWalkKm), places: plan.itinerary.stats.places, verified: Math.round(plan.itinerary.stats.verifiedShare * 100) })}
        </p>
        <p className="mt-1 text-muted-foreground">{t("generatedNote")}</p>
        <div className="mt-2 space-y-2">
          <Badge variant="secondary">{t(`baseMode.${plan.itinerary.baseMode}`)}</Badge>
          {plan.itinerary.stays.map((s) => {
            const hotel = plan.extras?.links.hotels.find((h) => h.stayId === s.id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-muted-foreground">{t("stayLabel", { city: city(s.citySlug), from: s.fromDay + 1, to: s.toDay + 1 })}</span>
                {hotel && <AffiliateLinks links={hotel.links} size="xs" />}
              </div>
            );
          })}
          {plan.extras && plan.extras.links.flights.length > 0 && <AffiliateLinks links={plan.extras.links.flights} label={t("links.flights")} size="xs" />}
          {plan.extras && (plan.extras.links.cars?.length ?? 0) > 0 && <AffiliateLinks links={plan.extras.links.cars ?? []} label={t("links.car")} size="xs" />}
          {plan.extras && (
            <AffiliateAbout links={[...plan.extras.links.hotels.flatMap((h) => h.links), ...plan.extras.links.flights, ...(plan.extras.links.cars ?? [])]} className="mt-1" />
          )}
          {plan.extras?.rates && (() => {
            const quote = Object.keys(plan.extras.rates.rates)[0];
            const value = quote ? plan.extras.rates.rates[quote] : undefined;
            return quote && value ? (
              <p className="text-xs text-muted-foreground">
                {t("rates", { base: plan.extras.rates.base, value: value.toFixed(2), quote })} {plan.extras.rates.source === "demo" && t("ratesDemo")}
              </p>
            ) : null;
          })()}
          {plan.extras?.seniors && plan.extras.seniors.countries.length > 0 && (
            <div className="rounded-xl bg-muted/60 p-3 text-xs" data-testid="seniors">
              <p className="font-medium text-foreground">{t("seniors.title")}</p>
              {plan.extras.seniors.countries.map((c) => (
                <p key={c.countryCode} className="mt-1 text-muted-foreground">
                  {seniorText(c.note, locale)}{" "}
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                    {t("seniors.source")}
                  </a>
                </p>
              ))}
              <p className="mt-1 text-muted-foreground">{t("seniors.verify")}</p>
            </div>
          )}
          {plan.extras && plan.extras.holidays.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t("holidaysTitle")}: </span>
              {plan.extras.holidays.map((h) => `${h.date.slice(8, 10)}/${h.date.slice(5, 7)} ${h.localName}`).join(" · ")}
            </p>
          )}
          {plan.extras && (
            <p className="text-xs text-muted-foreground">
              {t("sources", {
                routing: plan.extras.providers.routing === "osrm" ? t("routingReal") : t("routingEstimate"),
                weather: plan.extras.weatherSource ?? "—",
                holidays: plan.extras.providers.holidays ?? "—",
              })}
            </p>
          )}
        </div>
        {tripWarnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {tripWarnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {warningText(w)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList aria-label={t("viewsLabel")}>
            {views.map(({ id, icon: Icon }) => (
              <TabsTrigger key={id} value={id} className="gap-1.5">
                <Icon className="size-4" aria-hidden />
                {t(`views.${id}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {busy && <span className="text-xs text-muted-foreground">{t("actions.working")}</span>}
          {undo && (
            <Button type="button" variant="ghost" size="sm" onClick={undoLast} disabled={busy}>
              <Undo2 aria-hidden />
              {t("actions.undo")}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {(view === "timeline" || view === "map") && <DayRail plan={plan} dayIndex={dayIndex} onSelect={(i) => { setDayIndex(i); setSelectedId(null); }} />}

      {view === "timeline" && <DayTimeline plan={plan} dayIndex={dayIndex} selectedId={selectedId} onSelect={setSelectedId} actions={actions} busy={busy} />}
      {view === "map" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
          <PlanMap plan={plan} dayIndex={dayIndex} selectedId={selectedId} onSelect={setSelectedId} />
          <div className="max-h-[60vh] overflow-y-auto">
            <DayTimeline plan={plan} dayIndex={dayIndex} selectedId={selectedId} onSelect={setSelectedId} actions={actions} busy={busy} />
          </div>
        </div>
      )}
      {view === "calendar" && <PlanCalendar plan={plan} dayIndex={dayIndex} onSelect={(i) => { setDayIndex(i); setView("timeline"); }} />}
      {view === "list" && <PlanList plan={plan} selectedId={selectedId} onSelect={setSelectedId} actions={actions} />}

      {nowHref && (
        <Button asChild className="fixed bottom-20 end-4 z-30 h-12 rounded-full px-5 shadow-lg md:hidden">
          <Link href={nowHref}>
            <Navigation aria-hidden />
            {t("now.myDay")}
          </Link>
        </Button>
      )}

      <SwapSheet
        open={swap !== null}
        onOpenChange={(open) => !open && setSwap(null)}
        currentName={name(swapActivity?.placeId)}
        alternatives={swap?.alternatives ?? null}
        onPick={(placeId) => {
          if (!swap) return;
          void run({ type: "swap", dayIndex: swap.dayIndex, activityId: swap.activityId, placeId });
          setSwap(null);
        }}
      />
    </div>
  );
}

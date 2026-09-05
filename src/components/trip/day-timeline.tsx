"use client";

import { useFormatter, useTranslations } from "next-intl";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CloudRain, Info, Minus, Navigation, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/lib/planner/itinerary";
import type { GuestPlan } from "@/lib/guest/trips";
import { localDateOf } from "@/lib/guest/plan-helpers";
import { useDistance } from "@/lib/units/use-distance";
import { dayDirectionsUrl } from "@/lib/trip/google-maps";
import { ActivityCard, type ActivityActions } from "./activity-card";
import { usePlanText } from "./use-plan-text";
import { WeatherBadge } from "./weather-badge";

type Props = {
  plan: GuestPlan;
  dayIndex: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  actions?: ActivityActions & {
    onReorder: (dayIndex: number, placeIds: string[]) => void;
    onRebalance: (dayIndex: number, direction: "lighter" | "heavier") => void;
    onRebuild: (dayIndex: number) => void;
  };
  busy: boolean;
};

export function DayTimeline({ plan, dayIndex, selectedId, onSelect, actions, busy }: Props) {
  const t = useTranslations("plan");
  const format = useFormatter();
  const distance = useDistance();
  const { reasonText, warningText, name, city } = usePlanText(plan);
  const day = plan.itinerary.days[dayIndex];
  const directions = dayDirectionsUrl(plan, dayIndex);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  if (!day) return null;

  const visits = day.activities.filter((a) => a.kind === "visit");
  const visitIds = visits.map((a) => a.placeId!);
  const dayWarnings = [...day.warnings, ...plan.itinerary.warnings.filter((w) => w.dayIndex === day.index)].filter(
    (w) => w.code !== "unverified_data" && w.code !== "advance_booking_needed",
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = visitIds.indexOf(String(active.id));
    const to = visitIds.indexOf(String(over.id));
    if (from < 0 || to < 0 || !actions) return;
    const next = [...visitIds];
    next.splice(from, 1);
    next.splice(to, 0, String(active.id));
    actions.onReorder(day.index, next);
  }

  let visitCounter = -1;

  return (
    <section aria-label={t("dayTitle", { n: day.index + 1 })} className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">
            {t("dayTitle", { n: day.index + 1 })}
            <span className="ms-2 text-base font-normal text-muted-foreground">
              {format.dateTime(localDateOf(day.date), { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {city(day.citySlug)}
            {day.kind !== "full" && ` · ${t(`kinds.${day.kind}`)}`}
            {day.theme && ` · ${t(`themes.${day.theme}` as never)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <WeatherBadge weather={plan.extras?.weather[day.date]} />
          <Badge variant={day.stats.intensity === "heavy" ? "default" : "secondary"}>{t(`intensity.${day.stats.intensity}`)}</Badge>
          <span className="text-muted-foreground">{t("walk", { distance: distance(day.stats.walkKm) })}</span>
          <span className="text-muted-foreground">{t("placesCount", { count: visits.length })}</span>
        </div>
      </header>

      {directions && (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="secondary">
            <a href={directions.url} target="_blank" rel="noopener noreferrer">
              <Navigation aria-hidden />
              {t("map.navigateDay")}
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">{directions.truncated ? t("map.navigateTruncated", { max: 10 }) : t("map.navigateHint")}</span>
        </div>
      )}

      {actions && (
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy || visits.length === 0} onClick={() => actions.onRebalance(day.index, "lighter")}>
          <Minus aria-hidden />
          {t("actions.lighter")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => actions.onRebalance(day.index, "heavier")}>
          <Plus aria-hidden />
          {t("actions.heavier")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => actions.onRebuild(day.index)}>
          <RefreshCw aria-hidden />
          {t("actions.rebuild")}
        </Button>
      </div>
      )}

      {dayWarnings.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {dayWarnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {warningText(w)}
                {w.placeId && <span className="text-muted-foreground"> ({name(w.placeId)})</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      {visits.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("emptyDay")}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visitIds} strategy={verticalListSortingStrategy}>
            <ol className="space-y-3">
              {day.activities.map((a) => {
                if (a.kind === "visit") visitCounter += 1;
                return a.kind === "visit" && actions ? (
                  <SortableActivity
                    key={a.id}
                    plan={plan}
                    dayIndex={day.index}
                    activity={a}
                    index={visitCounter}
                    selected={selectedId === a.id}
                    onSelect={onSelect}
                    actions={actions}
                    reasonText={reasonText}
                  />
                ) : (
                  <ActivityCard key={a.id} plan={plan} dayIndex={day.index} activity={a} index={visitCounter} selected={a.kind === "visit" && selectedId === a.id} onSelect={onSelect} reasonText={reasonText} />
                );
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {day.rainPlan.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          <CloudRain className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-foreground">{t("rainPlan")}: </span>
            {day.rainPlan.map(name).join(" · ")}
          </span>
        </p>
      )}
    </section>
  );
}

function SortableActivity(props: {
  plan: GuestPlan;
  dayIndex: number;
  activity: Activity;
  index: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
  actions: ActivityActions;
  reasonText: Parameters<typeof ActivityCard>[0]["reasonText"];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.activity.placeId! });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <ActivityCard {...props} dragHandle={{ ...attributes, ...listeners, ref: setActivatorNodeRef }} />
    </div>
  );
}

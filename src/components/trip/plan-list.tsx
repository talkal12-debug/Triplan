"use client";

import { cloneElement } from "react";
import { useTranslations } from "next-intl";
import { useCalendarFormat } from "@/lib/i18n/use-calendar-format";
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Activity } from "@/lib/planner/itinerary";
import type { GuestPlan } from "@/lib/guest/trips";
import { ActivityCard, type ActivityActions } from "./activity-card";
import { usePlanText } from "./use-plan-text";
import { cn } from "@/lib/utils";

type Props = {
  plan: GuestPlan;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  actions?: ActivityActions & {
    onReorder: (dayIndex: number, placeIds: string[]) => void;
    onMoveTo: (fromDay: number, activityId: string, toDay: number, position: number) => void;
  };
};

/** All days at once, with drag-and-drop within and between days. */
export function PlanList({ plan, selectedId, onSelect, actions }: Props) {
  const t = useTranslations("plan");
  const fmtDate = useCalendarFormat();
  const { reasonText, city } = usePlanText(plan);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dayOf = new Map<string, number>();
  const visitsByDay = plan.itinerary.days.map((d) => {
    const ids = d.activities.filter((a) => a.kind === "visit").map((a) => a.placeId!);
    ids.forEach((id) => dayOf.set(id, d.index));
    return ids;
  });

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || !actions) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const fromDay = dayOf.get(activeId);
    if (fromDay === undefined) return;
    const toDay = overId.startsWith("day-") ? Number(overId.slice(4)) : dayOf.get(overId);
    if (toDay === undefined) return;
    const overIndex = overId.startsWith("day-") ? visitsByDay[toDay].length : visitsByDay[toDay].indexOf(overId);

    if (fromDay === toDay) {
      if (activeId === overId) return;
      const ids = [...visitsByDay[fromDay]];
      ids.splice(ids.indexOf(activeId), 1);
      ids.splice(overIndex, 0, activeId);
      actions.onReorder(fromDay, ids);
    } else {
      const activity = plan.itinerary.days[fromDay].activities.find((a) => a.placeId === activeId);
      if (activity) actions.onMoveTo(fromDay, activity.id, toDay, overIndex);
    }
  }

  return (
    <div className="space-y-6">
      {actions && <p className="text-sm text-muted-foreground">{t("list.hint")}</p>}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        {plan.itinerary.days.map((day, di) => (
          <DayContainer key={day.index} id={`day-${day.index}`} empty={visitsByDay[di].length === 0}>
            <h3 className="mb-2 font-semibold">
              {t("dayTitle", { n: day.index + 1 })}
              <span className="ms-2 text-sm font-normal text-muted-foreground">
                {fmtDate(day.date, { weekday: "short", day: "numeric", month: "short" })} · {city(day.citySlug)}
              </span>
            </h3>
            <SortableContext items={visitsByDay[di]} strategy={verticalListSortingStrategy}>
              {visitsByDay[di].length === 0 ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">{t("list.empty")}</p>
              ) : (
                <ol className="space-y-2">
                  {day.activities
                    .filter((a): a is Activity & { placeId: string } => a.kind === "visit" && Boolean(a.placeId))
                    .map((a, i) => (
                      <SortableRow key={a.id} id={a.placeId}>
                        <ActivityCard plan={plan} dayIndex={day.index} activity={a} index={i} selected={selectedId === a.id} onSelect={onSelect} actions={actions} reasonText={reasonText} compact />
                      </SortableRow>
                    ))}
                </ol>
              )}
            </SortableContext>
          </DayContainer>
        ))}
      </DndContext>
    </div>
  );
}

function DayContainer({ id, empty, children }: { id: string; empty: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} className={cn("rounded-md border bg-card p-3 transition-colors", isOver && empty && "border-primary bg-primary/5")}>
      {children}
    </section>
  );
}

function SortableRow({ id, children }: { id: string; children: React.ReactElement<{ dragHandle?: unknown }> }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      {cloneElement(children, { dragHandle: { ...attributes, ...listeners, ref: setActivatorNodeRef } })}
    </div>
  );
}

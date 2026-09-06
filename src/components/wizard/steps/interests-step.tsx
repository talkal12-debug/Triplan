"use client";

import { useTranslations } from "next-intl";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { eveningStyles, interests, type Interest } from "@/lib/planner/types";
import { Chip, OptionCard } from "../controls";
import type { StepProps } from "../step-props";
import { cn } from "@/lib/utils";

const RANKED = 5;

export function InterestsStep({ prefs, set, errors }: StepProps) {
  const t = useTranslations("wizard.interests");
  const selected = prefs.interests;
  const ranked = selected.slice(0, RANKED);
  const rest = selected.slice(RANKED);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function toggle(i: Interest) {
    set("interests", selected.includes(i) ? selected.filter((x) => x !== i) : [...selected, i]);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= selected.length) return;
    set("interests", arrayMove(selected, from, to));
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    move(selected.indexOf(active.id as Interest), selected.indexOf(over.id as Interest));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("title")}>
        {interests.map((i) => (
          <Chip key={i} selected={selected.includes(i)} onToggle={() => toggle(i)}>
            {t(`options.${i}`)}
          </Chip>
        ))}
      </div>
      {errors.includes("interests.atLeastOne") && (
        <p role="alert" className="text-sm text-destructive">
          {t("atLeastOne")}
        </p>
      )}

      {ranked.length > 0 && (
        <section aria-labelledby="ranked-title">
          <h3 id="ranked-title" className="font-medium">
            {t("ranked")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("rankedHint")}</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ranked} strategy={verticalListSortingStrategy}>
              <ol className="mt-3 space-y-2">
                {ranked.map((i, index) => (
                  <RankedItem
                    key={i}
                    id={i}
                    index={index}
                    label={t(`options.${i}`)}
                    canDown={index < selected.length - 1}
                    onUp={() => move(index, index - 1)}
                    onDown={() => move(index, index + 1)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="rest-title">
          <h3 id="rest-title" className="font-medium">
            {t("rest")}
          </h3>
          <ol className="mt-2 space-y-2">
            {rest.map((i, k) => {
              const index = RANKED + k;
              return (
                <li key={i} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <span className="flex-1">{t(`options.${i}`)}</span>
                  <button
                    type="button"
                    aria-label={t("moveUp", { name: t(`options.${i}`) })}
                    onClick={() => move(index, index - 1)}
                    className="grid size-9 place-items-center rounded-full hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("evening.title")}</legend>
        <p className="text-sm text-muted-foreground">{t("evening.subtitle")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {eveningStyles.map((style) => (
            <OptionCard key={style} name="evening" selected={prefs.evening === style} onSelect={() => set("evening", style)} title={t(`evening.options.${style}.title`)} body={t(`evening.options.${style}.body`)} />
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function RankedItem({
  id,
  index,
  label,
  canDown,
  onUp,
  onDown,
}: {
  id: string;
  index: number;
  label: string;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const t = useTranslations("wizard.interests");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border-2 bg-card px-2 py-2",
        isDragging ? "z-10 border-primary shadow-lg" : "border-primary/40",
      )}
    >
      <button
        type="button"
        aria-label={t("dragHandle", { name: label })}
        className="grid size-9 cursor-grab touch-none place-items-center rounded-full text-muted-foreground hover:bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <span className="grid size-7 place-items-center rounded-full bg-sunset text-sm font-semibold text-sunset-foreground" aria-label={t("rank", { n: index + 1 })}>
        {index + 1}
      </span>
      <span className="flex-1 font-medium">{label}</span>
      <button
        type="button"
        aria-label={t("moveUp", { name: label })}
        disabled={index === 0}
        onClick={onUp}
        className="grid size-9 place-items-center rounded-full hover:bg-muted disabled:opacity-30 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label={t("moveDown", { name: label })}
        disabled={!canDown}
        onClick={onDown}
        className="grid size-9 place-items-center rounded-full hover:bg-muted disabled:opacity-30 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </li>
  );
}

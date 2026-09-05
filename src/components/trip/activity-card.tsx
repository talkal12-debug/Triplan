"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { ArrowLeftRight, Bike, Bus, Car, Coffee, Footprints, GripVertical, History, Hotel, Lock, LockOpen, MoreHorizontal, Trash2, Utensils, CalendarArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Activity, Reason } from "@/lib/planner/itinerary";
import type { GuestPlan } from "@/lib/guest/trips";
import type { Locale } from "@/lib/i18n/locales";
import { hhmm, localDateOf, placeLabel, placeSummary } from "@/lib/guest/plan-helpers";
import { cn } from "@/lib/utils";
import { AffiliateLinks } from "./affiliate-links";
import { VoteBar } from "./vote-bar";

const transitIcons = { walk: Footprints, transit: Bus, car: Car, bike: Bike } as const;

export type ActivityActions = {
  onSwap: (activityId: string) => void;
  onLock: (activityId: string) => void;
  onRemove: (activityId: string) => void;
  onMove: (activityId: string, toDay: number) => void;
  /** "Already visited": remove from this plan and remember it for future trips. */
  onVisited?: (activityId: string) => void;
};

type Props = {
  plan: GuestPlan;
  dayIndex: number;
  activity: Activity;
  index: number;
  selected: boolean;
  onSelect: (id: string | null) => void;
  actions?: ActivityActions;
  reasonText: (r: Reason) => string;
  /** dnd-kit handle props, when the card is sortable */
  dragHandle?: React.HTMLAttributes<HTMLButtonElement> & { ref?: (el: HTMLElement | null) => void };
  compact?: boolean;
};

export function ActivityCard({ plan, dayIndex, activity: a, index, selected, onSelect, actions, reasonText, dragHandle, compact }: Props) {
  const t = useTranslations("plan");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const place = a.placeId ? plan.places[a.placeId] : undefined;
  const isVisit = a.kind === "visit";
  const name = isVisit ? placeLabel(place, locale, a.placeId ?? "") : t(`activity.${a.kind}` as never);
  const Transit = a.transitFromPrev ? transitIcons[a.transitFromPrev.mode] : null;
  const Icon = a.kind === "meal" ? Utensils : a.kind === "rest" ? Coffee : Hotel;
  const summary = placeSummary(place, locale);

  return (
    <li className="relative">
      {a.transitFromPrev && Transit && (
        <p className="mb-1 flex items-center gap-1.5 ps-2 text-xs text-muted-foreground">
          <Transit className="size-3.5" aria-hidden />
          {t(`transit.${a.transitFromPrev.mode}`, { minutes: a.transitFromPrev.minutes })}
          {a.transitFromPrev.estimated && <span>({t("estimated")})</span>}
        </p>
      )}
      <div
        onClick={() => isVisit && onSelect(selected ? null : a.id)}
        className={cn(
          "flex gap-2 rounded-2xl border-2 bg-card p-3 transition-colors",
          isVisit && "cursor-pointer hover:border-primary/40",
          selected ? "border-primary bg-primary/5" : "border-border",
          !isVisit && "border-dashed bg-muted/30",
        )}
      >
        {dragHandle && isVisit && (
          <button
            type="button"
            aria-label={t("dragHandle", { name })}
            className="grid size-9 shrink-0 cursor-grab touch-none place-items-center self-center rounded-full text-muted-foreground hover:bg-muted active:cursor-grabbing outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={(e) => e.stopPropagation()}
            {...dragHandle}
          >
            <GripVertical className="size-5" aria-hidden />
          </button>
        )}
        {isVisit && (
          <span className="grid size-7 shrink-0 place-items-center self-start rounded-full bg-primary text-xs font-semibold text-primary-foreground" aria-hidden>
            {index + 1}
          </span>
        )}
        {!isVisit && <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <time className="text-sm tabular-nums text-muted-foreground" dir="ltr">
              {hhmm(a.startMin)}–{hhmm(a.endMin)}
            </time>
            <span className={cn("font-medium", !isVisit && "text-muted-foreground")}>{name}</span>
            {a.locked && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Lock className="size-3" aria-hidden />
                {t("locked")}
              </Badge>
            )}
            {a.dataQuality && a.dataQuality !== "verified" && (
              <Badge variant="outline" className="text-[10px]">
                {t(`dataQuality.${a.dataQuality}`)}
              </Badge>
            )}
          </div>
          {isVisit && !compact && summary && (
            <p className="mt-1 text-sm leading-snug text-muted-foreground" dir="auto">
              {summary.text}
              {summary.url && (
                <>
                  {" "}
                  <a href={summary.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-xs underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                    {t("summarySource")}
                  </a>
                </>
              )}
            </p>
          )}
          {isVisit && !compact && !summary && place && (
            <p className="mt-1 text-sm text-muted-foreground">{t(`categories.${place.category}`)}</p>
          )}
          {isVisit && !compact && a.reasons.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1">
              {a.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {reasonText(r)}
                </li>
              ))}
              {place?.source === "osm" && <li className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t("unverifiedPlace")}</li>}
            </ul>
          )}
          {isVisit && !compact && a.placeId && plan.extras?.links.tickets[a.placeId] && (
            <AffiliateLinks links={plan.extras.links.tickets[a.placeId]} label={t("links.tickets")} size="xs" className="mt-1.5" about />
          )}
          {isVisit && !compact && <VoteBar activityId={a.id} />}
        </div>
        {isVisit && actions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 shrink-0 self-start" aria-label={t("actions.menu", { name })} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => actions.onSwap(a.id)}>
                <ArrowLeftRight aria-hidden />
                {t("actions.swap")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onLock(a.id)}>
                {a.locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
                {a.locked ? t("actions.unlock") : t("actions.lock")}
              </DropdownMenuItem>
              {plan.itinerary.days.length > 1 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <CalendarArrowDown aria-hidden />
                    {t("actions.moveTo")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {plan.itinerary.days
                      .filter((d) => d.index !== dayIndex)
                      .map((d) => (
                        <DropdownMenuItem key={d.index} onSelect={() => actions.onMove(a.id, d.index)}>
                          {t("actions.moveToDay", { n: d.index + 1, date: format.dateTime(localDateOf(d.date), { day: "numeric", month: "short" }) })}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              <DropdownMenuSeparator />
              {actions.onVisited && (
                <DropdownMenuItem onSelect={() => actions.onVisited?.(a.id)}>
                  <History aria-hidden />
                  {t("actions.visited")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onSelect={() => actions.onRemove(a.id)}>
                <Trash2 aria-hidden />
                {t("actions.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </li>
  );
}

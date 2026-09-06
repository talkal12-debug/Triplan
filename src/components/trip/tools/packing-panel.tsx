"use client";

import { useTranslations } from "next-intl";
import { updateGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import { buildPackingList, type PackingItem } from "@/lib/trip/packing";
import type { WizardContext } from "@/components/wizard/step-props";
import { cn } from "@/lib/utils";

type Props = { trip: GuestTrip; ctx: WizardContext; onTripChange: (trip: GuestTrip) => void };

const groups: PackingItem["group"][] = ["documents", "clothing", "gear", "kids", "health", "tech"];

export function PackingPanel({ trip, ctx, onTripChange }: Props) {
  const t = useTranslations("tools.packing");
  const tItem = t as unknown as (key: string, values?: Record<string, string | number>) => string;
  const plugTypes = ctx.plugTypesByCountry?.[trip.preferences.destinations[0]?.countryCode.toUpperCase() ?? ""];
  const items = buildPackingList({ prefs: trip.preferences, weather: trip.plan?.extras?.weather, plugTypes });
  const ticked = trip.packing ?? {};
  const done = items.filter((i) => ticked[i.id]).length;

  function toggle(id: string) {
    const next = { ...ticked, [id]: !ticked[id] };
    const updated = updateGuestTrip(trip.id, { packing: next }) ?? { ...trip, packing: next };
    onTripChange(updated);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      <p className="text-sm font-medium" aria-live="polite">
        {t("progress", { done, total: items.length })}
      </p>
      {groups.map((g) => {
        const list = items.filter((i) => i.group === g);
        if (list.length === 0) return null;
        return (
          <fieldset key={g} className="rounded-md border bg-card p-3">
            <legend className="px-1 text-sm font-semibold">{t(`groups.${g}`)}</legend>
            <ul className="space-y-1">
              {list.map((i) => (
                <li key={i.id}>
                  <label className={cn("flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-muted", ticked[i.id] && "text-muted-foreground line-through")}>
                    <input type="checkbox" checked={Boolean(ticked[i.id])} onChange={() => toggle(i.id)} className="size-5 accent-primary" />
                    <span>{tItem(`items.${i.id}`, { note: i.note ?? "" })}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

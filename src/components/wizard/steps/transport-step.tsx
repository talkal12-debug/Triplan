"use client";

import { useTranslations } from "next-intl";
import { Bike, Bus, Car, Footprints, Users } from "lucide-react";
import { transportModes, type TransportMode } from "@/lib/planner/types";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "../controls";
import type { StepProps } from "../step-props";
import { cn } from "@/lib/utils";

const icons = { walk: Footprints, bike: Bike, car: Car, transit: Bus, tours: Users } as const;
const weights = [1, 2, 3] as const;

export function TransportStep({ prefs, set, ctx, errors }: StepProps) {
  const t = useTranslations("wizard.transport");
  const { transport, carOptions } = prefs;

  function setWeight(mode: TransportMode, weight: number) {
    set("transport", { ...transport, [mode]: weight });
  }

  const destinationCountries = prefs.destinations
    .map((d) => ctx.countries.find((c) => c.code === d.countryCode))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => set("transport", { walk: 2, bike: 2, car: 2, transit: 2, tours: 2 })}
        >
          {t("mixAll")}
        </Button>
      </div>

      {transportModes.map((mode) => {
        const Icon = icons[mode];
        const on = transport[mode] > 0;
        return (
          <div
            key={mode}
            className={cn(
              "rounded-md border-2 bg-card p-4 transition-colors",
              on ? "border-primary/60" : "border-border",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-md",
                  on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <label className="flex flex-1 cursor-pointer items-center justify-between gap-3">
                <span className="font-semibold">{t(`modes.${mode}`)}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={on}
                  onChange={(e) => setWeight(mode, e.target.checked ? 2 : 0)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                    on ? "bg-primary" : "bg-muted-foreground/30",
                  )}
                >
                  <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-transform", on ? "start-6" : "start-1")} />
                </span>
              </label>
            </div>
            {on && (
              <div
                role="radiogroup"
                aria-label={t("weightLabel", { mode: t(`modes.${mode}`) })}
                className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-muted p-1"
              >
                {weights.map((w) => (
                  <button
                    key={w}
                    type="button"
                    role="radio"
                    aria-checked={transport[mode] === w}
                    onClick={() => setWeight(mode, w)}
                    className={cn(
                      "min-h-10 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      transport[mode] === w ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`weights.${w}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {errors.includes("transport.atLeastOne") && (
        <p role="alert" className="text-sm text-destructive">
          {t("atLeastOne")}
        </p>
      )}

      {transport.car > 0 && (
        <fieldset className="space-y-3 rounded-md border border-dashed p-4">
          <legend className="px-1 font-medium">{t("carTitle")}</legend>
          {destinationCountries.map((c) => (
            <p key={c.code} className="text-sm text-muted-foreground">
              {t("drivingSideNote", { country: c.name, side: t(c.drivingSide === "left" ? "sideLeft" : "sideRight") })}
            </p>
          ))}
          <SwitchRow
            checked={carOptions.oppositeSideOk}
            onChange={(v) => set("carOptions", { ...carOptions, oppositeSideOk: v })}
            label={t("oppositeSideOk")}
          />
          <SwitchRow
            checked={carOptions.avoidMountainRoads}
            onChange={(v) => set("carOptions", { ...carOptions, avoidMountainRoads: v })}
            label={t("avoidMountainRoads")}
          />
          <SwitchRow
            checked={carOptions.avoidCityDriving}
            onChange={(v) => set("carOptions", { ...carOptions, avoidCityDriving: v })}
            label={t("avoidCityDriving")}
          />
        </fieldset>
      )}
    </div>
  );
}

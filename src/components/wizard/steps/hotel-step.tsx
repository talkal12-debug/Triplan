"use client";

import { useTranslations } from "next-intl";
import { Home, Route, Sparkles } from "lucide-react";
import { baseModes, hotelTypes, locationPrefs, recommendBaseMode } from "@/lib/planner/types";
import { Chip, OptionCard } from "../controls";
import type { StepProps } from "../step-props";

const icons = { single: Home, multi: Route, auto: Sparkles } as const;

export function HotelStep({ prefs, set }: StepProps) {
  const t = useTranslations("wizard.hotel");
  const { hotel } = prefs;
  const rec = recommendBaseMode(prefs);

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-medium">{t("type")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {hotelTypes.map((type) => (
            <Chip key={type} selected={hotel.type === type} onToggle={() => set("hotel", { ...hotel, type })}>
              {t(`types.${type}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-medium">{t("location")}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {locationPrefs.map((pref) => (
            <Chip key={pref} selected={hotel.locationPref === pref} onToggle={() => set("hotel", { ...hotel, locationPref: pref })}>
              {t(`locations.${pref}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-medium">{t("baseMode")}</legend>
        <div className="grid gap-3" role="radiogroup">
          {baseModes.map((mode) => {
            const Icon = icons[mode];
            return (
              <OptionCard
                key={mode}
                name="baseMode"
                selected={hotel.baseMode === mode}
                onSelect={() => set("hotel", { ...hotel, baseMode: mode })}
                title={t(`baseModes.${mode}.title`)}
                body={t(`baseModes.${mode}.body`)}
                icon={<Icon className="size-5" aria-hidden />}
              />
            );
          })}
        </div>
        {hotel.baseMode === "auto" && prefs.destinations.length > 0 && (
          <p className="mt-3 rounded-xl bg-primary/10 p-3 text-sm">
            <span className="font-medium">{t("recommendation", { mode: t(`baseModes.${rec.mode}.title`) })}</span>{" "}
            {t(`reasons.${rec.reason}`)}
          </p>
        )}
      </fieldset>
    </div>
  );
}

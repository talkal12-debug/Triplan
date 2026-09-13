"use client";

import { useTranslations } from "next-intl";
import { Footprints, Mountain, Armchair, Compass, Umbrella } from "lucide-react";
import { accessibilityNeeds, efforts, tripStyles, type AccessibilityNeed } from "@/lib/planner/types";
import { Chip, OptionCard } from "../controls";
import type { StepProps } from "../step-props";

const icons = { low: Armchair, medium: Footprints, high: Mountain } as const;
const styleIcons = { explore: Compass, relax: Umbrella } as const;

export function PaceStep({ prefs, set }: StepProps) {
  const t = useTranslations("wizard.pace");

  function toggle(need: AccessibilityNeed) {
    set(
      "accessibility",
      prefs.accessibility.includes(need)
        ? prefs.accessibility.filter((n) => n !== need)
        : [...prefs.accessibility, need],
    );
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">{t("style.title")}</legend>
        <p className="text-sm text-muted-foreground">{t("style.subtitle")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tripStyles.map((style) => {
            const Icon = styleIcons[style];
            return <OptionCard key={style} name="tripStyle" selected={prefs.tripStyle === style} onSelect={() => set("tripStyle", style)} title={t(`style.options.${style}.title`)} body={t(`style.options.${style}.body`)} icon={<Icon className="size-5" aria-hidden />} />;
          })}
        </div>
      </fieldset>
      <div className="grid gap-3" role="radiogroup" aria-label={t("title")}>
        {efforts.map((e) => {
          const Icon = icons[e];
          return (
            <OptionCard
              key={e}
              name="effort"
              selected={prefs.effort === e}
              onSelect={() => set("effort", e)}
              title={t(`options.${e}.title`)}
              body={t(`options.${e}.body`)}
              icon={<Icon className="size-5" aria-hidden />}
            />
          );
        })}
      </div>
      {prefs.travelers.length > 0 ? (
        <p className="text-sm text-muted-foreground">{t("accessibilityFromTravelers")}</p>
      ) : (
      <fieldset>
        <legend className="mb-2 font-medium">{t("accessibility")}</legend>
        <div className="flex flex-wrap gap-2">
          {accessibilityNeeds.map((need) => (
            <Chip key={need} selected={prefs.accessibility.includes(need)} onToggle={() => toggle(need)}>
              {t(`accessibilityOptions.${need}`)}
            </Chip>
          ))}
        </div>
      </fieldset>
      )}
    </div>
  );
}

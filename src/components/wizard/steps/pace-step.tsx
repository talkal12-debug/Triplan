"use client";

import { useTranslations } from "next-intl";
import { Footprints, Mountain, Armchair } from "lucide-react";
import { accessibilityNeeds, efforts, type AccessibilityNeed } from "@/lib/planner/types";
import { Chip, OptionCard } from "../controls";
import type { StepProps } from "../step-props";

const icons = { low: Armchair, medium: Footprints, high: Mountain } as const;

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
    </div>
  );
}

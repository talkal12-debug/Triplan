"use client";

import { useTranslations } from "next-intl";
import { Sparkles, Repeat, Compass } from "lucide-react";
import { visitNumbers } from "@/lib/planner/types";
import { FieldLabel, OptionCard, inputClass } from "../controls";
import type { StepProps } from "../step-props";

const icons = { 1: Sparkles, 2: Repeat, 3: Compass } as const;

export function VisitStep({ prefs, set }: StepProps) {
  const t = useTranslations("wizard.visit");
  return (
    <div className="space-y-6">
      <div className="grid gap-3" role="radiogroup" aria-label={t("title")}>
        {visitNumbers.map((n) => {
          const Icon = icons[n];
          return (
            <OptionCard
              key={n}
              name="visit"
              selected={prefs.visitNumber === n}
              onSelect={() => set("visitNumber", n)}
              title={t(`options.${n}.title`)}
              body={t(`options.${n}.body`)}
              icon={<Icon className="size-5" aria-hidden />}
            />
          );
        })}
      </div>
      {prefs.visitNumber > 1 && (
        <div>
          <FieldLabel htmlFor="already-seen" hint={t("seenHint")}>
            {t("seenLabel")}
          </FieldLabel>
          <textarea
            id="already-seen"
            rows={3}
            maxLength={2000}
            value={prefs.alreadySeenNotes}
            onChange={(e) => set("alreadySeenNotes", e.target.value)}
            placeholder={t("seenPlaceholder")}
            className={`${inputClass} h-auto py-3`}
          />
        </div>
      )}
    </div>
  );
}

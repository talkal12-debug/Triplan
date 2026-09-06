"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { allErrors } from "@/lib/wizard/validate";
import type { WizardStep } from "@/lib/wizard/steps";
import { PreferencesSummary } from "../preferences-summary";
import type { StepProps } from "../step-props";

export function SummaryStep({ prefs, ctx }: StepProps) {
  const t = useTranslations("wizard");
  const errors = allErrors(prefs);
  const failing = Object.keys(errors) as WizardStep[];

  return (
    <div className="space-y-6">
      {failing.length > 0 && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4" aria-hidden />
            {t("summary.errors")}
          </p>
          <ul className="mt-2 space-y-1">
            {failing.map((step) => (
              <li key={step}>
                <Link href={`/plan/${step}`} className="underline underline-offset-4">
                  {t(`steps.${step}`)}
                </Link>
                : {errors[step]!.map((e) => t(e)).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <PreferencesSummary prefs={prefs} ctx={ctx} editable />
    </div>
  );
}

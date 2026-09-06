"use client";

import { useTranslations } from "next-intl";
import { Coins, Gem, PiggyBank } from "lucide-react";
import { budgetLevels, currencies } from "@/lib/planner/types";
import { FieldLabel, OptionCard, inputClass } from "../controls";
import type { StepProps } from "../step-props";

const icons = { budget: PiggyBank, mid: Coins, luxury: Gem } as const;

export function BudgetStep({ prefs, set }: StepProps) {
  const t = useTranslations("wizard.budget");
  const { budget } = prefs;
  return (
    <div className="space-y-6">
      <div className="grid gap-3" role="radiogroup" aria-label={t("title")}>
        {budgetLevels.map((level) => {
          const Icon = icons[level];
          return (
            <OptionCard
              key={level}
              name="budget"
              selected={budget.level === level}
              onSelect={() => set("budget", { ...budget, level })}
              title={t(`levels.${level}.title`)}
              body={t(`levels.${level}.body`)}
              icon={<Icon className="size-5" aria-hidden />}
            />
          );
        })}
      </div>
      <div className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-[1fr_auto]">
        <div>
          <FieldLabel htmlFor="daily-cap" hint={t("perPerson")}>
            {t("dailyCap")}
          </FieldLabel>
          <input
            id="daily-cap"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000}
            step={10}
            placeholder={t("capPlaceholder")}
            value={budget.dailyCap ?? ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              set("budget", { ...budget, dailyCap: e.target.value && Number.isFinite(n) && n > 0 ? Math.round(n) : null });
            }}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="currency">{t("currency")}</FieldLabel>
          <select
            id="currency"
            value={budget.currency}
            onChange={(e) => set("budget", { ...budget, currency: e.target.value as (typeof currencies)[number] })}
            className={`${inputClass} sm:w-28`}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

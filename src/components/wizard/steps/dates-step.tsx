"use client";

import { useFormatter, useTranslations } from "next-intl";
import { CloudSun } from "lucide-react";
import { seasonFor, tripEndDate } from "@/lib/planner/types";
import { FieldLabel, Stepper, inputClass } from "../controls";
import type { StepProps } from "../step-props";

export function DatesStep({ prefs, set, ctx, errors }: StepProps) {
  const t = useTranslations("wizard.dates");
  const format = useFormatter();
  const today = new Date().toISOString().slice(0, 10);
  const { dates } = prefs;

  const first = ctx.countries.find((c) => c.code === prefs.destinations[0]?.countryCode);
  const validStart = !Number.isNaN(new Date(`${dates.start}T00:00:00`).getTime());
  const season = first && validStart ? seasonFor(dates.start, first.lat) : null;
  const end = validStart ? tripEndDate(dates) : null;

  return (
    <div className="space-y-6">
      <div>
        <FieldLabel htmlFor="start-date">{t("start")}</FieldLabel>
        <input
          id="start-date"
          type="date"
          value={dates.start}
          min={today}
          onChange={(e) => set("dates", { ...dates, start: e.target.value })}
          className={inputClass}
          aria-invalid={errors.length > 0}
        />
        {errors.includes("dates.pastDate") && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {t("pastDate")}
          </p>
        )}
        {errors.includes("dates.invalidDate") && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {t("invalidDate")}
          </p>
        )}
      </div>

      <Stepper
        label={t("days")}
        hint={end ? t("end", { date: format.dateTime(new Date(`${end}T00:00:00`), { dateStyle: "medium" }) }) : undefined}
        value={dates.days}
        min={1}
        max={30}
        onChange={(days) => set("dates", { ...dates, days })}
        increaseLabel={t("days")}
        decreaseLabel={t("days")}
      />

      {season && (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed bg-muted/40 p-4 text-sm">
          <CloudSun className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="font-medium">{t("season", { season: t(`seasons.${season}`) })}</p>
            <p className="text-muted-foreground">{t("weatherLater")}</p>
          </div>
        </div>
      )}

      <fieldset className="rounded-2xl border bg-card p-4">
        <legend className="px-1 font-medium">{t("flights")}</legend>
        <p className="mb-3 text-sm text-muted-foreground">{t("flightsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="arrival-time">{t("arrival")}</FieldLabel>
            <input
              id="arrival-time"
              type="time"
              value={dates.arrivalTime ?? ""}
              onChange={(e) => set("dates", { ...dates, arrivalTime: e.target.value || null })}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel htmlFor="departure-time">{t("departure")}</FieldLabel>
            <input
              id="departure-time"
              type="time"
              value={dates.departureTime ?? ""}
              onChange={(e) => set("dates", { ...dates, departureTime: e.target.value || null })}
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}

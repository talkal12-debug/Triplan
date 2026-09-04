"use client";

import { useTranslations } from "next-intl";
import { CloudRain, CloudSun, Sun, Snowflake } from "lucide-react";
import type { PlanExtras } from "@/lib/guest/trips";

type Props = { weather: PlanExtras["weather"][string] | undefined; compact?: boolean };

/** Rain chance + temperatures for one day, labelled forecast vs last-year normals. */
export function WeatherBadge({ weather, compact }: Props) {
  const t = useTranslations("plan");
  if (!weather) return null;
  const rainy = weather.precipProbability >= 50;
  const cold = weather.tempMax !== null && weather.tempMax <= 5;
  const Icon = rainy ? CloudRain : cold ? Snowflake : weather.precipProbability >= 25 ? CloudSun : Sun;
  const temp = weather.tempMax !== null && weather.tempMin !== null ? t("weather.temp", { min: Math.round(weather.tempMin), max: Math.round(weather.tempMax) }) : null;
  const title = `${t(`weather.${weather.kind}`)}: ${t("weather.rain", { probability: Math.round(weather.precipProbability) })}${temp ? `, ${temp}` : ""}`;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={title} aria-label={title}>
      <Icon className={rainy ? "size-4 text-primary" : "size-4 text-sunset"} aria-hidden />
      {!compact && (
        <>
          <span dir="ltr">{temp}</span>
          {rainy && <span>{t("weather.rain", { probability: Math.round(weather.precipProbability) })}</span>}
          {weather.kind === "normals" && <span className="opacity-70">({t("weather.normals")})</span>}
        </>
      )}
    </span>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** MapLibre is ~250 KB: load it only when the map tab is opened. */
export const PlanMap = dynamic(() => import("./plan-map-inner").then((m) => m.PlanMapInner), {
  ssr: false,
  loading: () => <MapLoading />,
});

function MapLoading() {
  const t = useTranslations("plan");
  return (
    <div className="relative h-[60vh] min-h-80 w-full" aria-busy>
      <Skeleton className="h-full w-full rounded-2xl" />
      <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t("map.loading")}</p>
    </div>
  );
}

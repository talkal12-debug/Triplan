"use client";

import { useLocale, useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlaceSeed } from "@/lib/data/schemas";
import type { Locale } from "@/lib/i18n/locales";
import { placeLabel } from "@/lib/guest/plan-helpers";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  alternatives: PlaceSeed[] | null;
  onPick: (placeId: string) => void;
};

export function SwapSheet({ open, onOpenChange, currentName, alternatives, onPick }: Props) {
  const t = useTranslations("plan");
  const locale = useLocale() as Locale;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("swap.title", { name: currentName })}</SheetTitle>
          <SheetDescription>{t("swap.subtitle")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          {alternatives === null ? (
            <>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </>
          ) : alternatives.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("swap.none")}</p>
          ) : (
            alternatives.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{placeLabel(p, locale)}</p>
                  <p className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    <span>{t("swap.minutes", { minutes: p.visitMinutes })}</span>
                    {p.dataQuality !== "verified" && <Badge variant="outline" className="text-[10px]">{t(`dataQuality.${p.dataQuality}`)}</Badge>}
                    {p.requiresAdvanceBooking && <Badge variant="outline" className="text-[10px]">{t("reasons.advance_booking")}</Badge>}
                  </p>
                </div>
                <Button type="button" size="sm" onClick={() => onPick(p.id)}>
                  {t("swap.pick")}
                </Button>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

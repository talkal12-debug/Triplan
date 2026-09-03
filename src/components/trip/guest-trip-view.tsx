"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Construction, MapPinOff, Pencil, Plus } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import { useWizardStore } from "@/lib/wizard/store";
import { PreferencesSummary } from "@/components/wizard/preferences-summary";
import type { WizardContext } from "@/components/wizard/step-props";

type Props = { id: string; ctx: WizardContext };

export function GuestTripView({ id, ctx }: Props) {
  const t = useTranslations("trip");
  const format = useFormatter();
  const router = useRouter();
  const [trip, setTrip] = useState<GuestTrip | null | undefined>(undefined);

  useEffect(() => {
    setTrip(getGuestTrip(id) ?? null);
  }, [id]);

  function editPreferences() {
    if (!trip) return;
    // Load this trip's preferences back into the wizard draft.
    useWizardStore.setState({ prefs: trip.preferences, reached: "summary", done: [] });
    router.push("/plan/summary");
  }

  if (trip === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-10 sm:px-6" aria-busy>
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (trip === null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
        <span className="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <MapPinOff className="size-8" aria-hidden />
        </span>
        <h1 className="mt-6 text-3xl font-bold">{t("notFound")}</h1>
        <p className="mt-3 text-muted-foreground">{t("notFoundBody")}</p>
        <Button asChild className="mt-8">
          <Link href="/plan">{t("newTrip")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("created", { date: format.dateTime(new Date(trip.createdAt), { dateStyle: "medium" }) })}
          </p>
        </div>
        <Badge variant="secondary">{t("savedLocally")}</Badge>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed bg-sunset/10 p-4 text-sm">
        <Construction className="mt-0.5 size-5 shrink-0 text-sunset" aria-hidden />
        <p>{t("engineSoon")}</p>
      </div>

      <div className="mt-8">
        <PreferencesSummary prefs={trip.preferences} ctx={ctx} />
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={editPreferences}>
          <Pencil aria-hidden />
          {t("editPrefs")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/trips">{t("myTrips")}</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/plan/destination">
            <Plus aria-hidden />
            {t("newTrip")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

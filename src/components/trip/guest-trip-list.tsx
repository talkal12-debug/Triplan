"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/country-flag";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteGuestTrip, listGuestTrips, onGuestTripsChange, type GuestTrip } from "@/lib/guest/trips";
import type { CountryLite } from "@/lib/data/countries-lite";

type Props = { countries: CountryLite[] };

export function GuestTripList({ countries }: Props) {
  const t = useTranslations("trip");
  const td = useTranslations("wizard.dates");
  const format = useFormatter();
  const [trips, setTrips] = useState<GuestTrip[] | undefined>(undefined);
  const byCode = new Map(countries.map((c) => [c.code, c]));

  useEffect(() => {
    setTrips(listGuestTrips());
    // Trips merged in from the account (sign-in, another device) show up without a reload.
    return onGuestTripsChange((_all, changed) => {
      if (changed?.remote) setTrips(listGuestTrips());
    });
  }, []);

  function remove(id: string) {
    if (!window.confirm(t("deleteConfirm"))) return;
    deleteGuestTrip(id);
    setTrips(listGuestTrips());
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t("myTrips")}</h1>
        <Button asChild>
          <Link href="/plan/destination">
            <Plus aria-hidden />
            {t("newTrip")}
          </Link>
        </Button>
      </div>

      {trips === undefined ? (
        <div className="mt-6 space-y-3" aria-busy>
          <Skeleton className="h-20 w-full rounded-md" />
          <Skeleton className="h-20 w-full rounded-md" />
        </div>
      ) : trips.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">{t("noTrips")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {trips.map((trip) => {
            const start = new Date(`${trip.preferences.dates.start}T00:00:00`);
            return (
              <li key={trip.id} className="flex items-center gap-3 rounded-md border bg-card p-4">
                <div className="flex -space-x-1 rtl:space-x-reverse">
                  {trip.preferences.destinations.map((d) => (
                    <CountryFlag key={d.countryCode} code={d.countryCode} size={24} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {trip.preferences.destinations.map((d) => byCode.get(d.countryCode)?.name ?? d.countryCode).join(" · ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format.dateTime(start, { dateStyle: "medium" })} · {td("daysValue", { count: trip.preferences.dates.days })}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/trip/${trip.id}`}>{t("open")}</Link>
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label={t("delete")} onClick={() => remove(trip.id)}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

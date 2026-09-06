"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { updateGuestTrip, type GuestTrip, type Journal } from "@/lib/guest/trips";
import { localDateOf } from "@/lib/guest/plan-helpers";
import { inputClass } from "@/components/wizard/controls";
import { usePlanText } from "../use-plan-text";
import { cn } from "@/lib/utils";

type Props = { trip: GuestTrip; onTripChange: (trip: GuestTrip) => void };

const emptyJournal = (): Journal => ({ days: {}, summary: "" });

/** Trip journal: a note and a 1-5 rating per day, plus a closing note. Saved with the trip. */
export function JournalPanel({ trip, onTripChange }: Props) {
  const t = useTranslations("journal");
  if (!trip.plan) return <p className="text-sm text-muted-foreground">{t("noPlan")}</p>;
  return <JournalEntries trip={trip as GuestTrip & { plan: NonNullable<GuestTrip["plan"]> }} onTripChange={onTripChange} />;
}

function JournalEntries({ trip, onTripChange }: { trip: GuestTrip & { plan: NonNullable<GuestTrip["plan"]> }; onTripChange: (trip: GuestTrip) => void }) {
  const t = useTranslations("journal");
  const tp = useTranslations("plan");
  const format = useFormatter();
  const journal = trip.journal ?? emptyJournal();
  const days = trip.plan.itinerary.days;
  const { city } = usePlanText(trip.plan);

  function save(next: Journal) {
    const updated = updateGuestTrip(trip.id, { journal: next }) ?? { ...trip, journal: next };
    onTripChange(updated);
  }
  function setDay(index: number, patch: Partial<Journal["days"][string]>) {
    const key = String(index);
    const current = journal.days[key] ?? { text: "", rating: null };
    save({ ...journal, days: { ...journal.days, [key]: { ...current, ...patch } } });
  }

  if (days.length === 0) return <p className="text-sm text-muted-foreground">{t("noPlan")}</p>;

  const rated = Object.values(journal.days).filter((d) => d.rating);
  const average = rated.length ? rated.reduce((s, d) => s + (d.rating ?? 0), 0) / rated.length : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      {average !== null && (
        <p className="text-sm font-medium" aria-live="polite">
          {t("average", { value: format.number(average, { maximumFractionDigits: 1 }), days: rated.length })}
        </p>
      )}
      <ol className="space-y-4">
        {days.map((day) => {
          const entry = journal.days[String(day.index)] ?? { text: "", rating: null };
          const id = `journal-day-${day.index}`;
          return (
            <li key={day.index} className="rounded-md border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor={id} className="font-medium">
                  {tp("dayTitle", { n: day.index + 1 })}
                  <span className="ms-2 text-sm font-normal text-muted-foreground">
                    {format.dateTime(localDateOf(day.date), { weekday: "short", day: "numeric", month: "short" })} · {city(day.citySlug)}
                  </span>
                </label>
                <div role="radiogroup" aria-label={t("rating")} className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={entry.rating === n}
                      aria-label={t("stars", { n })}
                      onClick={() => setDay(day.index, { rating: entry.rating === n ? null : n })}
                      className="grid size-9 place-items-center rounded-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Star className={cn("size-5", entry.rating && n <= entry.rating ? "fill-sunset text-sunset" : "text-muted-foreground")} aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id={id}
                rows={2}
                maxLength={5000}
                value={entry.text}
                onChange={(e) => setDay(day.index, { text: e.target.value })}
                placeholder={t("dayPlaceholder")}
                className={`${inputClass} mt-3 h-auto py-2`}
              />
            </li>
          );
        })}
      </ol>
      <div>
        <label htmlFor="journal-summary" className="block text-sm font-medium">
          {t("summary")}
        </label>
        <textarea
          id="journal-summary"
          rows={3}
          maxLength={5000}
          value={journal.summary}
          onChange={(e) => save({ ...journal, summary: e.target.value })}
          placeholder={t("summaryPlaceholder")}
          className={`${inputClass} mt-1 h-auto py-2`}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("privacy")}</p>
    </div>
  );
}

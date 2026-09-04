"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { z } from "zod";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createGuestTrip } from "@/lib/guest/trips";
import { templateSchema } from "@/lib/templates/schema";

type Props = { id: string };

const responseSchema = z.object({ template: templateSchema });

/**
 * A future start date on the same weekday as the template's, at least 4 weeks
 * ahead. Same weekday keeps every day's opening hours valid, so the copied plan
 * does not lose stops to "closed on this date" repairs.
 */
function nextSameWeekday(templateStart: string, now = new Date()): string {
  const target = new Date(`${templateStart}T00:00:00Z`).getUTCDay();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 28));
  while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Copies a gallery template into "My trips": preferences + the plan snapshot.
 * The traveller can then edit every step and rebuild for their own dates.
 */
export function CloneTemplateButton({ id }: Props) {
  const t = useTranslations("gallery");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function clone() {
    setState("busy");
    try {
      const res = await fetch(`/api/templates/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(String(res.status));
      const { template } = responseSchema.parse(await res.json());
      const start = nextSameWeekday(template.preferences.dates.start);
      const preferences = { ...template.preferences, dates: { ...template.preferences.dates, start } };
      // Shift the plan's days to the new dates; weather and holidays were for the old ones, so drop them
      // (a rebuild fetches fresh ones).
      const plan = {
        ...template.plan,
        itinerary: { ...template.plan.itinerary, days: template.plan.itinerary.days.map((d) => ({ ...d, date: addDays(start, d.index) })) },
        extras: template.plan.extras ? { ...template.plan.extras, weather: {}, holidays: [] } : undefined,
      };
      const trip = createGuestTrip(preferences, { plan });
      router.push(`/trip/${trip.id}`);
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" onClick={clone} disabled={state === "busy"}>
        <Copy aria-hidden />
        {state === "busy" ? t("cloning") : t("clone")}
      </Button>
      {state === "error" && (
        <p className="text-xs text-destructive" role="alert">
          {t("cloneError")}
        </p>
      )}
    </div>
  );
}

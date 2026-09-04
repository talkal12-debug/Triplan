"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Save } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createGuestTrip, updateGuestTrip, type GuestPlan, type GuestTrip } from "@/lib/guest/trips";
import type { TripPreferences } from "@/lib/planner/types";
import { PlanWorkspace } from "./plan-workspace";

type Props = {
  token: string;
  preferences: TripPreferences;
  plan: GuestPlan;
  canEdit: boolean;
  destinations: string;
};

/** A plan opened from a share link. Read-only, or editable when the owner allowed it. */
export function SharedTripView({ token, preferences, plan, canEdit, destinations }: Props) {
  const t = useTranslations("shared");
  const router = useRouter();
  const [trip, setTrip] = useState<GuestTrip & { plan: GuestPlan }>({
    id: `share-${token}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences,
    plan,
  });
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [copied, setCopied] = useState(false);

  async function save() {
    setStatus("saving");
    const res = await fetch(`/api/share/${token}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: trip.plan }) });
    setStatus(res.ok ? "saved" : "idle");
    if (res.ok) setDirty(false);
  }

  function copyToMine() {
    const mine = createGuestTrip(preferences);
    updateGuestTrip(mine.id, { plan: trip.plan });
    setCopied(true);
    router.push(`/trip/${mine.id}`);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("by", { destinations })}</p>
        </div>
        <Badge variant="secondary">{canEdit ? t("editable") : t("readOnly")}</Badge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {canEdit && (
          <Button type="button" onClick={save} disabled={!dirty || status === "saving"}>
            {status === "saved" && !dirty ? <Check aria-hidden /> : <Save aria-hidden />}
            {status === "saving" ? t("saving") : status === "saved" && !dirty ? t("saved") : t("save")}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={copyToMine} disabled={copied}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? t("copied") : t("copyToMine")}
        </Button>
      </div>
      <div className="mt-8">
        <PlanWorkspace
          trip={trip}
          readOnly={!canEdit}
          onTripChange={(next) => {
            if (next.plan) setTrip({ ...next, plan: next.plan });
            setDirty(true);
            setStatus("idle");
          }}
        />
      </div>
    </div>
  );
}

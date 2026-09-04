"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Calendar, Check, Copy, Download, ExternalLink, FileDown, Link2, Printer, WifiOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { SwitchRow } from "@/components/wizard/controls";
import { updateGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import { buildIcs } from "@/lib/export/ics";
import { buildGpx, buildKml } from "@/lib/export/geo";
import { downloadText, safeFilename } from "@/lib/export/download";
import { canCacheOffline, precacheMap } from "@/lib/offline/tiles";
import { localDateOf, placeLabel } from "@/lib/guest/plan-helpers";
import type { Locale } from "@/lib/i18n/locales";
import type { WizardContext } from "@/components/wizard/step-props";

type Props = { trip: GuestTrip; ctx: WizardContext; onTripChange: (trip: GuestTrip) => void };

export function SharePanel({ trip, ctx, onTripChange }: Props) {
  const t = useTranslations("tools.share");
  const tp = useTranslations("plan");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const [canEdit, setCanEdit] = useState(trip.share?.canEdit ?? false);
  const [busy, setBusy] = useState<"share" | "update" | "offline" | null>(null);
  const [copied, setCopied] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [offlineOk, setOfflineOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOfflineOk(canCacheOffline());
  }, []);

  const plan = trip.plan;
  const title = trip.preferences.destinations.map((d) => ctx.countries.find((c) => c.code === d.countryCode)?.name ?? d.countryCode).join(" · ");
  const exportOpts = {
    title: `Triplan · ${title}`,
    placeName: (id: string) => placeLabel(plan?.places[id], locale, id),
    kindLabel: (kind: string) => tp(`activity.${kind}` as never),
    dayLabel: (i: number) => `${tp("dayTitle", { n: i + 1 })} · ${format.dateTime(localDateOf(plan!.itinerary.days[i].date), { day: "numeric", month: "short" })}`,
  };
  const file = safeFilename(`triplan-${title}`);
  const shareUrl = trip.share ? `${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/share/${trip.share.token}` : null;

  async function createShare() {
    if (!plan) return;
    setBusy("share");
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: trip.preferences, plan, canEdit, title }),
      });
      const json = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !json.token) throw new Error(json.error ?? res.statusText);
      const share = { token: json.token, canEdit, createdAt: new Date().toISOString() };
      onTripChange(updateGuestTrip(trip.id, { share }) ?? { ...trip, share });
    } catch (err) {
      setError(t("shareError", { message: (err as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  async function updateShare() {
    if (!plan || !trip.share) return;
    setBusy("update");
    setError(null);
    try {
      const res = await fetch(`/api/share/${trip.share.token}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-triplan-share-owner": "1" },
        body: JSON.stringify({ preferences: trip.preferences, plan }),
      });
      if (!res.ok) throw new Error(res.statusText);
      setUpdated(true);
      setTimeout(() => setUpdated(false), 2500);
    } catch (err) {
      setError(t("shareError", { message: (err as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadOffline() {
    if (!plan) return;
    setBusy("offline");
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      const { tiles } = await precacheMap(plan, (done, total) => setProgress({ done, total }));
      const offline = { tiles, at: new Date().toISOString() };
      onTripChange(updateGuestTrip(trip.id, { offline }) ?? { ...trip, offline });
    } catch (err) {
      setError(t("offlineError", { message: (err as Error).message }));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  if (!plan) return <p className="text-sm text-muted-foreground">{tp("build")}</p>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold">{t("export")}</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/trip/${trip.id}/print`}>
              <Printer aria-hidden />
              {t("print")}
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadText(`${file}.ics`, buildIcs(plan, exportOpts), "text/calendar")}>
            <Calendar aria-hidden />
            {t("ics")}
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadText(`${file}.gpx`, buildGpx(plan, exportOpts), "application/gpx+xml")}>
            <FileDown aria-hidden />
            {t("gpx")}
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadText(`${file}.kml`, buildKml(plan, exportOpts), "application/vnd.google-earth.kml+xml")}>
            <FileDown aria-hidden />
            {t("kml")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("exportHint")}</p>
      </section>

      <section>
        <h3 className="font-semibold">{t("shareTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("shareHint")}</p>
        {!trip.share ? (
          <div className="mt-3 space-y-3">
            <SwitchRow checked={canEdit} onChange={setCanEdit} label={t("shareEdit")} />
            <Button type="button" onClick={createShare} disabled={busy !== null}>
              <Link2 aria-hidden />
              {busy === "share" ? t("creating") : t("create")}
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-medium">{t("linkReady")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={shareUrl ?? ""} dir="ltr" className="h-11 min-w-0 flex-1 rounded-xl border bg-muted px-3 text-sm" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                {copied ? t("copied") : t("copy")}
              </Button>
              <Button asChild variant="outline">
                <a href={shareUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  {t("open")}
                </a>
              </Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={updateShare} disabled={busy !== null}>
              {updated ? <Check aria-hidden /> : <Link2 aria-hidden />}
              {updated ? t("updated") : t("updateShared")}
            </Button>
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold">{t("offlineTitle")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("offlineHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={downloadOffline} disabled={busy !== null || offlineOk === false}>
            {offlineOk === false ? <WifiOff aria-hidden /> : <Download aria-hidden />}
            {progress ? t("offlineDownloading", { done: progress.done, total: progress.total }) : t("offlineDownload")}
          </Button>
          {trip.offline && !progress && <span className="text-sm text-emerald-700 dark:text-emerald-400">{t("offlineReady", { tiles: trip.offline.tiles })}</span>}
        </div>
        {offlineOk === false && <p className="mt-2 text-xs text-muted-foreground">{t("offlineUnsupported")}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{t("installHint")}</p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

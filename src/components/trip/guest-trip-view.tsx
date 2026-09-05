"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle, ChevronDown, MapPinOff, Pencil, Plus, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "next-auth/react";
import { getGuestTrip, guestPlanSchema, onGuestTripsChange, planExtrasSchema, updateGuestTrip, type GuestTrip } from "@/lib/guest/trips";
import { LINKS_VERSION } from "@/lib/links-version";
import { pullTrip } from "@/lib/trips/sync";
import { useCollabStore } from "@/lib/collab/store";
import { useWizardStore } from "@/lib/wizard/store";
import { PreferencesSummary } from "@/components/wizard/preferences-summary";
import type { WizardContext } from "@/components/wizard/step-props";
import { PlanWorkspace } from "./plan-workspace";
import { TripTools } from "./trip-tools";

type Props = { id: string; ctx: WizardContext };

export function GuestTripView({ id, ctx }: Props) {
  const t = useTranslations("trip");
  const tp = useTranslations("plan");
  const tt = useTranslations("tools");
  const format = useFormatter();
  const router = useRouter();
  const [trip, setTrip] = useState<GuestTrip | null | undefined>(undefined);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrefs, setShowPrefs] = useState(false);

  useEffect(() => {
    setTrip(getGuestTrip(id) ?? null);
    return onGuestTripsChange((_all, changed) => {
      if (changed?.remote && changed.id === id) setTrip(getGuestTrip(id) ?? null);
    });
  }, [id]);

  // Members: keep the trip and its votes/comments fresh while it is open (no real-time yet).
  const { status } = useSession();
  useEffect(() => {
    if (status !== "authenticated") return;
    const collab = useCollabStore.getState();
    const tick = () => {
      void collab.load(id).then((state) => {
        // Only shared trips can change elsewhere; own solo trips are not re-fetched.
        if (getGuestTrip(id)?.membership || (state && state.members.length > 1)) void pullTrip(id);
      });
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => {
      clearInterval(timer);
      collab.clear();
    };
  }, [status, id]);
  const readOnly = trip?.membership?.role === "viewer";

  // Plans saved before a link format change get fresh booking links (cheap: no re-planning).
  useEffect(() => {
    const extras = trip?.plan?.extras;
    if (!trip?.plan || !extras || (extras.links.version ?? 0) >= LINKS_VERSION) return;
    const plan = trip.plan;
    let cancelled = false;
    fetch("/api/plan/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: trip.preferences, itinerary: plan.itinerary, locale: ctx.locale }),
    })
      .then(async (r) => (r.ok ? planExtrasSchema.pick({ links: true, dining: true, evenings: true }).parse(await r.json()) : null))
      .then((fresh) => {
        if (!fresh || cancelled) return;
        // Merge into whatever is stored now: the descriptions refresh below may have written meanwhile.
        const current = getGuestTrip(trip.id);
        const base = current?.plan ?? plan;
        const updated = updateGuestTrip(trip.id, { plan: { ...base, extras: { ...(base.extras ?? extras), links: fresh.links, dining: fresh.dining, evenings: fresh.evenings } } });
        if (updated) setTrip(updated);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per trip id
  }, [trip?.id, trip?.plan?.extras?.links.version]);

  // Plans built before place descriptions existed (or opened in another language)
  // fetch the missing ones once per trip and language; places with no source stay as they are.
  const summariesChecked = useRef<string>("");
  useEffect(() => {
    const plan = trip?.plan;
    const key = `${trip?.id}:${ctx.locale}`;
    if (!trip || !plan || summariesChecked.current === key || plan.summariesFor?.includes(ctx.locale)) return;
    const wanted = ctx.locale === "en" ? ["en"] : [ctx.locale, "en"];
    const missing = Object.values(plan.places)
      .filter((p) => p.wikidata && !p.summary?.[ctx.locale])
      .map((p) => ({ id: p.id, wikidata: p.wikidata as string }));
    summariesChecked.current = key;
    if (missing.length === 0) return;
    fetch("/api/places/summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ places: missing.slice(0, 60), locales: wanted }),
    })
      .then(async (r) => (r.ok ? ((await r.json()) as { summaries: Record<string, Record<string, { text: string; url: string | null; translatedFrom?: string }>> }).summaries : null))
      .then((summaries) => {
        const current = getGuestTrip(trip.id);
        if (!current?.plan || !summaries) return;
        const places = Object.fromEntries(
          Object.entries(current.plan.places).map(([id, p]) => [id, summaries[id] ? { ...p, summary: { ...(p.summary ?? {}), ...summaries[id] } } : p]),
        );
        const summariesFor = [...new Set([...(current.plan.summariesFor ?? []), ctx.locale])];
        const updated = updateGuestTrip(trip.id, { plan: { ...current.plan, places, summariesFor } });
        if (updated) setTrip(updated);
      })
      .catch(() => undefined);
    // No cancellation: the result is merged into whatever is stored by then.
  }, [trip, ctx.locale]);

  function editPreferences() {
    if (!trip) return;
    useWizardStore.setState({ prefs: trip.preferences, reached: "summary", done: [] });
    router.push("/plan/summary");
  }

  async function build() {
    if (!trip) return;
    setBuilding(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: trip.preferences, locale: ctx.locale }),
      });
      const json: unknown = await res.json();
      if (!res.ok) {
        const msg = (json as { error?: string }).error === "unsupported_destination" ? tp("failedUnsupported") : (json as { message?: string }).message ?? res.statusText;
        setError(tp("failed", { message: msg }));
        return;
      }
      const data = json as { itinerary: unknown; places: unknown; cities: unknown; extras?: unknown; diagnostics: { unused: string[] } };
      const plan = guestPlanSchema.parse({ itinerary: data.itinerary, places: data.places, cities: data.cities, unused: data.diagnostics.unused, extras: data.extras });
      const updated = updateGuestTrip(trip.id, { plan });
      if (updated) setTrip(updated);
    } catch (err) {
      setError(tp("failed", { message: (err as Error).message }));
    } finally {
      setBuilding(false);
    }
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
        <Badge variant="secondary">
          {trip.membership
            ? t("sharedBy", { name: trip.membership.ownerName ?? "?", role: t(`roles.${trip.membership.role}`) })
            : status === "authenticated"
              ? t("synced")
              : t("savedLocally")}
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" onClick={build} disabled={building}>
          <Sparkles aria-hidden />
          {building ? tp("building") : trip.plan ? tp("rebuild") : tp("build")}
        </Button>
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

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {trip.plan ? (
        <section className="mt-8" aria-label={t("planLabel")}>
          <PlanWorkspace trip={trip as GuestTrip & { plan: NonNullable<GuestTrip["plan"]> }} onTripChange={setTrip} readOnly={readOnly} nowHref={`/trip/${trip.id}/now`} />
        </section>
      ) : (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-dashed bg-sunset/10 p-4 text-sm">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-sunset" aria-hidden />
          <p>{t("engineSoon")}</p>
        </div>
      )}

      <section className="mt-10" aria-label={tt("title")}>
        <TripTools trip={trip} ctx={ctx} onTripChange={setTrip} readOnly={readOnly} />
      </section>

      <section className="mt-10">
        <button
          type="button"
          onClick={() => setShowPrefs((v) => !v)}
          aria-expanded={showPrefs || !trip.plan}
          className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-start font-semibold hover:bg-muted"
        >
          {t("prefsLabel")}
          <ChevronDown className={`size-4 transition-transform ${showPrefs || !trip.plan ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {(showPrefs || !trip.plan) && (
          <div className="mt-3">
            <PreferencesSummary prefs={trip.preferences} ctx={ctx} />
          </div>
        )}
      </section>
    </div>
  );
}

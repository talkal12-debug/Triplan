"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWizardStore } from "@/lib/wizard/store";
import { nextStep, prevStep, stepIndex, wizardSteps, type WizardStep } from "@/lib/wizard/steps";
import { allErrors, applyStepDefault, stepErrors } from "@/lib/wizard/validate";
import { createGuestTrip } from "@/lib/guest/trips";
import { readProfileCache } from "@/lib/profile/client";
import { localeDir } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";
import type { StepProps, WizardContext } from "./step-props";
import { DestinationStep } from "./steps/destination-step";
// One chunk per step: a visitor on the destination step does not download the
// drag-and-drop code of the interests step or the summary's formatting.
// The destination step is the landing page of the wizard: imported statically so it is part of the
// first server-rendered HTML instead of a streamed Suspense boundary (better LCP, no layout shift).
const stepLoading = () => <Skeleton className="h-40 w-full rounded-2xl" />;
const stepComponents: Record<WizardStep, React.ComponentType<StepProps>> = {
  destination: DestinationStep,
  dates: dynamic(() => import("./steps/dates-step").then((m) => m.DatesStep), { loading: stepLoading }),
  party: dynamic(() => import("./steps/party-step").then((m) => m.PartyStep), { loading: stepLoading }),
  visit: dynamic(() => import("./steps/visit-step").then((m) => m.VisitStep), { loading: stepLoading }),
  pace: dynamic(() => import("./steps/pace-step").then((m) => m.PaceStep), { loading: stepLoading }),
  transport: dynamic(() => import("./steps/transport-step").then((m) => m.TransportStep), { loading: stepLoading }),
  interests: dynamic(() => import("./steps/interests-step").then((m) => m.InterestsStep), { loading: stepLoading }),
  budget: dynamic(() => import("./steps/budget-step").then((m) => m.BudgetStep), { loading: stepLoading }),
  hotel: dynamic(() => import("./steps/hotel-step").then((m) => m.HotelStep), { loading: stepLoading }),
  summary: dynamic(() => import("./steps/summary-step").then((m) => m.SummaryStep), { loading: stepLoading }),
};

/** Steps where "skip" makes sense (destination has no default, summary is the end). */
const skippable: WizardStep[] = ["dates", "party", "visit", "pace", "transport", "interests", "budget", "hotel"];

type Props = { step: WizardStep; ctx: WizardContext };

export function WizardShell({ step, ctx }: Props) {
  const t = useTranslations("wizard");
  const router = useRouter();
  const store = useWizardStore();
  const [building, setBuilding] = useState(false);
  const lastIndex = useRef(stepIndex(step));
  const direction = stepIndex(step) >= lastIndex.current ? 1 : -1;
  // The first step a visitor lands on paints without the slide-in (it would only delay the LCP);
  // moving between steps animates.
  const initialStep = useRef(step);
  const animate = step !== initialStep.current;
  useEffect(() => {
    lastIndex.current = stepIndex(step);
  }, [step]);

  // localStorage is only available on the client: hydrate the draft after mount.
  // A fresh draft starts from the traveller profile (defaults + places already visited).
  useEffect(() => {
    void Promise.resolve(useWizardStore.persist.rehydrate()).then(() => {
      const s = useWizardStore.getState();
      if (s.done.length > 0 || s.reached !== "destination") return;
      const cache = readProfileCache();
      const visited = cache.visited.map((v) => v.placeId);
      const defaults = cache.profile?.defaults ?? {};
      if (Object.keys(defaults).length === 0 && visited.length === 0) return;
      s.update({ ...defaults, alreadySeen: Array.from(new Set([...s.prefs.alreadySeen, ...visited])) });
    });
  }, []);

  const index = stepIndex(step);
  const total = wizardSteps.length;
  const errors = stepErrors(step, store.prefs);
  const next = nextStep(step);
  const prev = prevStep(step);
  const isSummary = step === "summary";
  const summaryBlocked = isSummary && Object.keys(allErrors(store.prefs)).length > 0;
  const Step = stepComponents[step];
  const rtl = localeDir[ctx.locale] === "rtl";
  // Reduced motion is handled globally in globals.css (animations collapse to ~0 ms).
  const slide = 24 * direction * (rtl ? -1 : 1);

  function goNext() {
    if (!next || errors.length) return;
    store.markDone(step, next);
    router.push(`/plan/${next}`);
  }

  function skip() {
    if (!next) return;
    store.update(applyStepDefault(step, store.prefs));
    store.markDone(step, next);
    router.push(`/plan/${next}`);
  }

  function build() {
    if (summaryBlocked) return;
    setBuilding(true);
    const trip = createGuestTrip(store.prefs);
    store.markDone("summary", "summary");
    router.push(`/trip/${trip.id}`);
  }

  function startOver() {
    if (window.confirm(t("startOverConfirm"))) {
      store.reset();
      router.push("/plan/destination");
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
      <header>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("stepOf", { current: index + 1, total })}</p>
          <button
            type="button"
            onClick={startOver}
            className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t("startOver")}
          </button>
        </div>
        <ol aria-label={t("progress")} className="mt-3 flex gap-1">
          {wizardSteps.map((s, i) => {
            const done = store.done.includes(s);
            const current = s === step;
            const reachable = done || i <= stepIndex(store.reached);
            const bar = (
              <span
                className={cn(
                  "block h-1.5 w-full rounded-full transition-colors",
                  current ? "bg-primary" : done ? "bg-primary/60" : "bg-muted",
                )}
              />
            );
            return (
              <li key={s} className="flex-1" aria-current={current ? "step" : undefined}>
                {reachable && !current ? (
                  <Link href={`/plan/${s}`} aria-label={t(`steps.${s}`)} className="block py-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded">
                    {bar}
                  </Link>
                ) : (
                  <span className="block py-2">
                    <span className="sr-only">{t(`steps.${s}`)}</span>
                    {bar}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">{t(`${step}.title`)}</h1>
        <p className="mt-1 text-muted-foreground">{t(`${step}.subtitle`)}</p>
      </header>

      {/*
        The step is server-rendered with the default answers and swapped for the saved draft right
        after localStorage rehydrates, so the first paint is real content (LCP) rather than a skeleton.
        Until then the controls are disabled (aria-busy) so a tap cannot land on stale defaults.
      */}
      <div className="mt-6 min-h-64" aria-busy={!store.hydrated} aria-label={store.hydrated ? undefined : t("loading")}>
        {/* Keyed on the step so the CSS enter animation (globals.css) replays; direction-aware via a custom property. */}
        <div key={step} className={cn(animate && "wizard-step-enter", !store.hydrated && "pointer-events-none")} style={{ "--wizard-slide": `${slide}px` } as React.CSSProperties}>
          <Step prefs={store.prefs} set={store.set} update={store.update} ctx={ctx} errors={errors} />
        </div>
      </div>

      <footer className="sticky bottom-16 z-30 mt-8 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <div className="flex items-center gap-2">
          {prev ? (
            <Button asChild variant="ghost" className="h-11">
              <Link href={`/plan/${prev}`}>
                <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
                {t("back")}
              </Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="flex-1" />
          {skippable.includes(step) && (
            <Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={skip}>
              {t("skip")}
            </Button>
          )}
          {isSummary ? (
            <Button type="button" className="h-11 px-5" onClick={build} disabled={summaryBlocked || building || !store.hydrated}>
              <Sparkles aria-hidden />
              {building ? t("summary.building") : t("summary.build")}
            </Button>
          ) : (
            <Button type="button" className="h-11 px-5" onClick={goNext} disabled={errors.length > 0 || !store.hydrated}>
              {t("next")}
              {next === "summary" ? <Check aria-hidden /> : <ArrowRight className="rtl:-scale-x-100" aria-hidden />}
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t("draftSaved")} · {t("guestNote")}</p>
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
import { DatesStep } from "./steps/dates-step";
import { PartyStep } from "./steps/party-step";
import { VisitStep } from "./steps/visit-step";
import { PaceStep } from "./steps/pace-step";
import { TransportStep } from "./steps/transport-step";
import { InterestsStep } from "./steps/interests-step";
import { BudgetStep } from "./steps/budget-step";
import { HotelStep } from "./steps/hotel-step";
import { SummaryStep } from "./steps/summary-step";

const stepComponents: Record<WizardStep, (props: StepProps) => React.ReactNode> = {
  destination: DestinationStep,
  dates: DatesStep,
  party: PartyStep,
  visit: VisitStep,
  pace: PaceStep,
  transport: TransportStep,
  interests: InterestsStep,
  budget: BudgetStep,
  hotel: HotelStep,
  summary: SummaryStep,
};

/** Steps where "skip" makes sense (destination has no default, summary is the end). */
const skippable: WizardStep[] = ["dates", "party", "visit", "pace", "transport", "interests", "budget", "hotel"];

type Props = { step: WizardStep; ctx: WizardContext };

export function WizardShell({ step, ctx }: Props) {
  const t = useTranslations("wizard");
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const store = useWizardStore();
  const [building, setBuilding] = useState(false);
  const lastIndex = useRef(stepIndex(step));
  const direction = stepIndex(step) >= lastIndex.current ? 1 : -1;
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
  const slide = reduceMotion ? 0 : 24 * direction * (rtl ? -1 : 1);

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

      <div className="mt-6 min-h-64">
        {store.hydrated ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: slide }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -slide }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
            >
              <Step prefs={store.prefs} set={store.set} update={store.update} ctx={ctx} errors={errors} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="space-y-3" aria-busy aria-label={t("loading")}>
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        )}
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

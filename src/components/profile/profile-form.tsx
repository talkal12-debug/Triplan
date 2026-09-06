"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Check, LogIn, Save, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CountryFlag } from "@/components/country-flag";
import { inputClass } from "@/components/wizard/controls";
import type { WizardContext } from "@/components/wizard/step-props";
import { PartyStep } from "@/components/wizard/steps/party-step";
import { PaceStep } from "@/components/wizard/steps/pace-step";
import { TransportStep } from "@/components/wizard/steps/transport-step";
import { InterestsStep } from "@/components/wizard/steps/interests-step";
import { BudgetStep } from "@/components/wizard/steps/budget-step";
import { HotelStep } from "@/components/wizard/steps/hotel-step";
import { defaultTripPreferences, type TripPreferences } from "@/lib/planner/types";
import { readProfileCache, refreshProfileCache, saveProfile, unmarkVisited, type ProfileCache } from "@/lib/profile/client";
import { profileDefaultsSchema, type ProfileDefaults } from "@/lib/profile/schema";

type Props = { ctx: WizardContext };

const defaultKeys = ["party", "effort", "accessibility", "transport", "carOptions", "interests", "budget", "hotel"] as const;

function pickDefaults(prefs: TripPreferences): ProfileDefaults {
  return profileDefaultsSchema.parse(Object.fromEntries(defaultKeys.map((k) => [k, prefs[k]])));
}

/**
 * Name + the wizard answers that rarely change + "already visited" archive.
 * Reuses the wizard step components on a scratch preferences object, so the
 * profile looks exactly like the questionnaire it prefills.
 */
export function ProfileForm({ ctx }: Props) {
  const t = useTranslations("profile");
  const ta = useTranslations("auth");
  const { data: session, status } = useSession();
  const signedIn = Boolean(session?.user);
  const [cache, setCache] = useState<ProfileCache | null>(null);
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<TripPreferences>(() => defaultTripPreferences());
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (status === "loading") return;
    const local = readProfileCache();
    const apply = (c: ProfileCache) => {
      setCache(c);
      setName(c.profile?.name ?? session?.user?.name ?? "");
      setPrefs({ ...defaultTripPreferences(), ...(c.profile?.defaults ?? {}) });
    };
    apply(local);
    if (signedIn) void refreshProfileCache().then((fresh) => fresh && apply(fresh));
  }, [status, signedIn, session?.user?.name]);

  const set = <K extends keyof TripPreferences>(key: K, value: TripPreferences[K]) => setPrefs((p) => ({ ...p, [key]: value }));
  const update = (patch: Partial<TripPreferences>) => setPrefs((p) => ({ ...p, ...patch }));
  const stepProps = { prefs, set, update, ctx, errors: [] };

  async function save() {
    setState("saving");
    const saved = await saveProfile({ name: name.trim() || null, defaults: pickDefaults(prefs) }, signedIn);
    setState(saved ? "saved" : "error");
    if (saved) setCache((c) => (c ? { ...c, profile: saved } : c));
  }

  async function forget(placeId: string) {
    await unmarkVisited(placeId, signedIn);
    setCache(readProfileCache());
  }

  if (!cache) return null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
        </div>
        {signedIn ? <Badge variant="secondary">{ta("synced")}</Badge> : <Badge variant="outline">{t("guestBadge")}</Badge>}
      </div>

      {!signedIn && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-4 text-sm">
          <span>{t("guestNote")}</span>
          <Button asChild size="sm" variant="outline">
            <Link href="/signin">
              <LogIn aria-hidden />
              {ta("signIn")}
            </Link>
          </Button>
        </div>
      )}

      <section className="mt-8">
        <label htmlFor="profile-name" className="block text-sm font-medium">
          {t("name")}
        </label>
        <input id="profile-name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} autoComplete="name" />
      </section>

      <section className="mt-10 space-y-12" aria-label={t("defaults")}>
        <h2 className="text-xl font-semibold">{t("defaults")}</h2>
        <p className="-mt-10 text-sm text-muted-foreground">{t("defaultsHint")}</p>
        <PartyStep {...stepProps} />
        <PaceStep {...stepProps} />
        <TransportStep {...stepProps} />
        <InterestsStep {...stepProps} />
        <BudgetStep {...stepProps} />
        <HotelStep {...stepProps} />
      </section>

      <div className="sticky bottom-20 z-10 mt-8 flex items-center gap-3 rounded-md border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
        <Button type="button" onClick={save} disabled={state === "saving"}>
          {state === "saved" ? <Check aria-hidden /> : <Save aria-hidden />}
          {state === "saving" ? t("saving") : state === "saved" ? t("saved") : t("save")}
        </Button>
        {state === "error" && (
          <p className="text-sm text-destructive" role="alert">
            {t("saveError")}
          </p>
        )}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">{t("visited")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("visitedHint")}</p>
        {cache.visited.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("visitedEmpty")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {cache.visited.map((v) => (
              <li key={v.placeId} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2">
                <CountryFlag code={v.countryCode} size={20} />
                <span className="min-w-0 flex-1 truncate">{v.name}</span>
                <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={t("visitedRemove", { name: v.name })} onClick={() => forget(v.placeId)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

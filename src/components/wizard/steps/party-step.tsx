"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Baby, Save, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, FieldLabel, inputClass } from "../controls";
import type { StepProps } from "../step-props";
import {
  accessibilityFromTravelers,
  needsFor,
  partyFromTravelers,
  travelersFromParty,
  type Traveler,
  type TravelerKind,
  type TravelerNeed,
} from "@/lib/planner/types";

const FAMILY_KEY = "triplan:family";

function loadFamily(): Traveler[] {
  try {
    const raw = localStorage.getItem(FAMILY_KEY);
    return raw ? (JSON.parse(raw) as Traveler[]) : [];
  } catch {
    return [];
  }
}

/**
 * Who is travelling, one row per person: kind, optional name, age for children,
 * and needs that shape the plan (little walking, wheelchair, stroller, naps).
 * The counts the planner uses are derived from these rows; the rows can be kept
 * on the device and loaded into the next trip.
 */
export function PartyStep({ prefs, set, errors }: StepProps) {
  const t = useTranslations("wizard.party");
  const [saved, setSaved] = useState<Traveler[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const idBase = useId();
  const travelers = prefs.travelers;

  useEffect(() => {
    setSaved(loadFamily());
  }, []);

  // Drafts from before named travellers existed carry only counts: turn them into rows once.
  useEffect(() => {
    if (travelers.length === 0) commit(travelersFromParty(prefs.party));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once
  }, []);

  function commit(next: Traveler[]) {
    set("travelers", next);
    set("party", partyFromTravelers(next));
    set("accessibility", accessibilityFromTravelers(next));
  }

  function add(kind: TravelerKind) {
    if (travelers.length >= 20) return;
    commit([...travelers, { id: `${kind}-${Date.now().toString(36)}-${travelers.length}`, name: "", kind, age: kind === "child" ? 8 : null, needs: [] }]);
  }

  function update(id: string, patch: Partial<Traveler>) {
    commit(travelers.map((tr) => (tr.id === id ? { ...tr, ...patch } : tr)));
  }

  function toggleNeed(tr: Traveler, need: TravelerNeed) {
    update(tr.id, { needs: tr.needs.includes(need) ? tr.needs.filter((n) => n !== need) : [...tr.needs, need] });
  }

  function saveFamily() {
    try {
      localStorage.setItem(FAMILY_KEY, JSON.stringify(travelers));
      setSaved(travelers);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch {
      /* private mode: nothing to save into */
    }
  }

  let childIndex = 0;

  return (
    <div className="space-y-5">
      <ol className="space-y-3" aria-label={t("listLabel")}>
        {travelers.map((tr) => {
          const isChild = tr.kind === "child";
          const n = isChild ? ++childIndex : 0;
          const nameId = `${idBase}-name-${tr.id}`;
          const ageId = `${idBase}-age-${tr.id}`;
          return (
            <li key={tr.id} className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-end gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-sm bg-muted px-2 py-1 text-xs font-medium">
                  {tr.kind === "infant" ? <Baby className="size-3.5" aria-hidden /> : <Users className="size-3.5" aria-hidden />}
                  {t(`kinds.${tr.kind}`)}
                </span>
                <div className="min-w-40 flex-1">
                  <FieldLabel htmlFor={nameId}>{t("name")}</FieldLabel>
                  <input id={nameId} type="text" value={tr.name} maxLength={40} placeholder={t("namePlaceholder")} onChange={(e) => update(tr.id, { name: e.target.value })} className={inputClass} autoComplete="off" />
                </div>
                {isChild && (
                  <div>
                    <FieldLabel htmlFor={ageId}>{t("childAge", { n })}</FieldLabel>
                    <select id={ageId} value={tr.age ?? 8} onChange={(e) => update(tr.id, { age: Number(e.target.value) })} className={inputClass}>
                      {Array.from({ length: 16 }, (_, k) => k + 2).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <Button type="button" size="icon" variant="ghost" aria-label={t("remove", { name: tr.name || t(`kinds.${tr.kind}`) })} onClick={() => commit(travelers.filter((x) => x.id !== tr.id))} disabled={travelers.length <= 1}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              {needsFor(tr).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t("needs.label", { name: tr.name || t(`kinds.${tr.kind}`) })}>
                  {needsFor(tr).map((need) => (
                    <Chip key={need} selected={tr.needs.includes(need)} onToggle={() => toggleNeed(tr, need)}>
                      {t(`needs.${need}`)}
                    </Chip>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add("adult")} disabled={travelers.length >= 20}>
          <UserPlus aria-hidden />
          {t("addAdult")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("senior")} disabled={travelers.length >= 20}>
          <UserPlus aria-hidden />
          {t("addSenior")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("child")} disabled={travelers.length >= 20}>
          <UserPlus aria-hidden />
          {t("addChild")}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("infant")} disabled={travelers.length >= 20}>
          <Baby aria-hidden />
          {t("addInfant")}
        </Button>
      </div>

      {errors.includes("party.noAdult") && (
        <p role="alert" className="text-sm text-destructive">
          {t("noAdult")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4 text-sm">
        <Button type="button" variant="secondary" size="sm" onClick={saveFamily}>
          <Save aria-hidden />
          {t("saveFamily")}
        </Button>
        {saved.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => commit(saved.map((tr, i) => ({ ...tr, id: `${tr.kind}-saved-${i}` })))}>
            {t("loadFamily", { count: saved.length })}
          </Button>
        )}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {justSaved ? t("saved") : t("saveHint")}
        </span>
      </div>
    </div>
  );
}

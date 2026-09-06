"use client";

import { useTranslations } from "next-intl";
import { FieldLabel, Stepper, SwitchRow, inputClass } from "../controls";
import type { StepProps } from "../step-props";

export function PartyStep({ prefs, set, errors }: StepProps) {
  const t = useTranslations("wizard.party");
  const { party } = prefs;
  const patch = (p: Partial<typeof party>) => set("party", { ...party, ...p });

  function setChildren(count: number) {
    const ages = [...party.childrenAges];
    while (ages.length < count) ages.push(8);
    patch({ childrenAges: ages.slice(0, count) });
  }

  return (
    <div className="space-y-4">
      <Stepper
        label={t("adults")}
        value={party.adults}
        min={1}
        max={20}
        onChange={(adults) => patch({ adults, seniors: Math.min(party.seniors, adults) })}
        increaseLabel={t("increase", { what: t("adults") })}
        decreaseLabel={t("decrease", { what: t("adults") })}
      />
      <Stepper
        label={t("seniors")}
        hint={t("seniorsHint")}
        value={party.seniors}
        min={0}
        max={party.adults}
        onChange={(seniors) => patch({ seniors })}
        increaseLabel={t("increase", { what: t("seniors") })}
        decreaseLabel={t("decrease", { what: t("seniors") })}
      />
      {errors.includes("party.seniorsTooMany") && (
        <p role="alert" className="text-sm text-destructive">
          {t("seniorsTooMany")}
        </p>
      )}
      <Stepper
        label={t("children")}
        value={party.childrenAges.length}
        min={0}
        max={10}
        onChange={setChildren}
        increaseLabel={t("increase", { what: t("children") })}
        decreaseLabel={t("decrease", { what: t("children") })}
      />
      {party.childrenAges.length > 0 && (
        <div className="grid gap-3 rounded-md border bg-card p-4 sm:grid-cols-2">
          {party.childrenAges.map((age, i) => (
            <div key={i}>
              <FieldLabel htmlFor={`child-age-${i}`}>{t("childAge", { n: i + 1 })}</FieldLabel>
              <select
                id={`child-age-${i}`}
                value={age}
                onChange={(e) => {
                  const ages = [...party.childrenAges];
                  ages[i] = Number(e.target.value);
                  patch({ childrenAges: ages });
                }}
                className={inputClass}
              >
                {Array.from({ length: 16 }, (_, k) => k + 2).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
      <Stepper
        label={t("infants")}
        value={party.infants}
        min={0}
        max={5}
        onChange={(infants) => patch({ infants, stroller: infants > 0 ? party.stroller : false })}
        increaseLabel={t("increase", { what: t("infants") })}
        decreaseLabel={t("decrease", { what: t("infants") })}
      />
      {(party.infants > 0 || party.childrenAges.some((a) => a < 5)) && (
        <SwitchRow checked={party.stroller} onChange={(stroller) => patch({ stroller })} label={t("stroller")} />
      )}
    </div>
  );
}

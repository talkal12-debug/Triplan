/** The 11 wizard steps, in order. Slugs appear in the URL: /plan/destination ... /plan/summary */
export const wizardSteps = [
  "destination",
  "wishlist",
  "dates",
  "party",
  "visit",
  "pace",
  "transport",
  "interests",
  "budget",
  "hotel",
  "summary",
] as const;

export type WizardStep = (typeof wizardSteps)[number];

export function isWizardStep(value: string): value is WizardStep {
  return (wizardSteps as readonly string[]).includes(value);
}

export function stepIndex(step: WizardStep): number {
  return wizardSteps.indexOf(step);
}

export function nextStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  return i < wizardSteps.length - 1 ? wizardSteps[i + 1] : null;
}

export function prevStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  return i > 0 ? wizardSteps[i - 1] : null;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { isWizardStep, wizardSteps } from "@/lib/wizard/steps";
import { getCountriesLite, getDemoCitiesLite } from "@/lib/data/countries-lite";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { PageMessages } from "@/i18n/page-messages";
import { seasonalItems } from "@/lib/data/seasonal";

type Props = { params: Promise<{ locale: string; step: string }> };

export function generateStaticParams() {
  return wizardSteps.map((step) => ({ step }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, step } = await params;
  if (!isWizardStep(step)) return {};
  const t = await getTranslations({ locale, namespace: "wizard" });
  return { title: `${t(`steps.${step}`)} · ${t("title")}` };
}

export default async function WizardStepPage({ params }: Props) {
  const { locale, step } = await params;
  if (!isWizardStep(step)) notFound();
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;

  return (
    <PageMessages namespaces={["wizard", "plan"]}>
      <WizardShell
        step={step}
        ctx={{
          locale: uiLocale,
          countries: getCountriesLite(uiLocale),
          cities: getDemoCitiesLite(uiLocale),
          seasonal: [...seasonalItems],
        }}
      />
    </PageMessages>
  );
}

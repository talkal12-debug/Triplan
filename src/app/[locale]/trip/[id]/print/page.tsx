import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getCountriesLite, getDemoCitiesLite } from "@/lib/data/countries-lite";
import { PrintView } from "@/components/trip/print-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "print" });
  return { title: t("title") };
}

export default async function PrintPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return <PrintView id={id} ctx={{ locale: uiLocale, countries: getCountriesLite(uiLocale), cities: getDemoCitiesLite(uiLocale) }} />;
}

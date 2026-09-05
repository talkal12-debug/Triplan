import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getCountriesLite } from "@/lib/data/countries-lite";
import { GuestTripList } from "@/components/trip/guest-trip-list";
import { PageMessages } from "@/i18n/page-messages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trip" });
  return { title: t("myTrips") };
}

export default async function TripsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return (
    <PageMessages namespaces={["trip", "wizard"]}>
      <GuestTripList countries={getCountriesLite(uiLocale)} />
    </PageMessages>
  );
}

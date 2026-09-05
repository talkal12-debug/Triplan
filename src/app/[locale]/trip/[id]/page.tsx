import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getCountriesLite, getDemoCitiesLite } from "@/lib/data/countries-lite";
import { GuestTripView } from "@/components/trip/guest-trip-view";
import { plugTypesByCountry } from "@/lib/data/countries";
import { PageMessages } from "@/i18n/page-messages";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "trip" });
  return { title: t("title") };
}

export default async function TripPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return (
    <PageMessages namespaces={["plan", "tools", "trip", "journal", "collab", "chat", "wizard"]}>
      <GuestTripView
        id={id}
        ctx={{ locale: uiLocale, countries: getCountriesLite(uiLocale), cities: getDemoCitiesLite(uiLocale), plugTypesByCountry: plugTypesByCountry() }}
      />
    </PageMessages>
  );
}

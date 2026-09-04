import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { getCountriesLite, getDemoCitiesLite } from "@/lib/data/countries-lite";
import { ProfileForm } from "@/components/profile/profile-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "profile" });
  return { title: t("title") };
}

/**
 * Traveler profile. Works for guests too (kept on this device); members get it
 * saved to the account. The page itself stays static: the session is read on the client.
 */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return <ProfileForm ctx={{ locale: uiLocale, countries: getCountriesLite(uiLocale), cities: getDemoCitiesLite(uiLocale) }} />;
}

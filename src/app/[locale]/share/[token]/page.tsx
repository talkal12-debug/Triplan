import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { countryName, getCountry } from "@/lib/data/countries";
import { tripPreferencesSchema } from "@/lib/planner/types";
import { guestPlanSchema } from "@/lib/guest/schema";
import { SharedTripView } from "@/components/trip/shared-trip-view";

type Props = { params: Promise<{ locale: string; token: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shared" });
  return { title: t("title"), robots: { index: false } };
}

export default async function SharePage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const trip = await prisma.trip.findUnique({ where: { shareToken: token } });
  if (!trip?.plan) notFound();
  const preferences = tripPreferencesSchema.safeParse(JSON.parse(trip.preferences));
  const plan = guestPlanSchema.safeParse(JSON.parse(trip.plan));
  if (!preferences.success || !plan.success) notFound();
  const destinations = preferences.data.destinations
    .map((d) => {
      const c = getCountry(d.countryCode);
      return c ? countryName(c, uiLocale) : d.countryCode;
    })
    .join(" · ");
  return <SharedTripView token={token} preferences={preferences.data} plan={plan.data} canEdit={trip.shareCanEdit} destinations={destinations} />;
}

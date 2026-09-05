import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JoinTrip } from "@/components/trip/join-trip";
import { PageMessages } from "@/i18n/page-messages";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "collab" });
  return { title: t("joinTitle") };
}

/** Invite link landing: sign in if needed, then join the trip and open it. */
export default async function JoinPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  return (
    <PageMessages namespaces={["collab"]}>
      <JoinTrip token={token} />
    </PageMessages>
  );
}

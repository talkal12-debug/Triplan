import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NowView } from "@/components/trip/now-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "plan" });
  return { title: t("now.title") };
}

export default async function NowPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <NowView id={id} />;
}

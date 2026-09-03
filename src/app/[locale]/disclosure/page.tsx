import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "disclosure" });
  return { title: t("title") };
}

export default async function DisclosurePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("disclosure");
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
        <p>{t("intro")}</p>
        <p>{t("affiliate")}</p>
        <p>{t("marking")}</p>
        <p>{t("data")}</p>
        <p className="rounded-xl border border-dashed p-4 text-sm">{t("noKeys")}</p>
      </div>
    </article>
  );
}

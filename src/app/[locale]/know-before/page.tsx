import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { countries, countryName, isDemoCountry } from "@/lib/data/countries";
import { CountrySearch, type CountryListItem } from "@/components/know-before/country-search";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "knowBefore" });
  return { title: t("title"), description: t("subtitle") };
}

export default async function KnowBeforeIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("knowBefore");
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const collator = new Intl.Collator(uiLocale);

  const items: CountryListItem[] = countries
    .map((c) => {
      const name = countryName(c, uiLocale);
      const local = c.names.local && c.names.local !== name ? c.names.local : null;
      return {
        code: c.code,
        flag: c.flag,
        name,
        local,
        search: [...new Set(Object.values(c.names).map((n) => n.toLowerCase()))],
        demo: isDemoCountry(c.code),
      };
    })
    .sort((a, b) => collator.compare(a.name, b.name));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-8">
        <CountrySearch countries={items} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  Car,
  Clock,
  Coins,
  Droplets,
  Globe,
  HandCoins,
  Landmark,
  Languages,
  Phone,
  Plug,
  Siren,
} from "lucide-react";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { countries, countryName, getCountry, getCountryExtras, isDemoCountry } from "@/lib/data/countries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink } from "@/components/external-link";
import { CountryFlag } from "@/components/country-flag";

type Props = { params: Promise<{ locale: string; country: string }> };

export function generateStaticParams() {
  return countries.map((c) => ({ country: c.code.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, country } = await params;
  const c = getCountry(country);
  if (!c) return {};
  const t = await getTranslations({ locale, namespace: "knowBefore" });
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  return { title: `${countryName(c, uiLocale)} · ${t("title")}` };
}

const officialLinks = [
  { key: "linkMfa", href: "https://www.gov.il/he/departments/ministry_of_foreign_affairs" },
  { key: "linkWho", href: "https://www.who.int/travel-advice" },
  { key: "linkCdc", href: "https://wwwnc.cdc.gov/travel/destinations/list" },
  { key: "linkIata", href: "https://www.iatatravelcentre.com/" },
] as const;

export default async function CountryPage({ params }: Props) {
  const { locale, country: code } = await params;
  setRequestLocale(locale);
  const country = getCountry(code);
  if (!country) notFound();

  const t = await getTranslations("knowBefore");
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const name = countryName(country, uiLocale);
  const local = country.names.local && country.names.local !== name ? country.names.local : null;
  const extras = getCountryExtras(country.code);
  const demo = isDemoCountry(country.code);
  const listFormat = new Intl.ListFormat(uiLocale, { style: "long", type: "conjunction" });

  const facts: { key: string; icon: typeof Coins; value: string }[] = [
    {
      key: "currency",
      icon: Coins,
      value: country.currencies.length
        ? listFormat.format(country.currencies.map((c) => `${c.name} (${c.code}${c.symbol ? `, ${c.symbol}` : ""})`))
        : t("unknown"),
    },
    { key: "languages", icon: Languages, value: country.languages.length ? listFormat.format(country.languages) : t("unknown") },
    { key: "drivingSide", icon: Car, value: t(country.drivingSide) },
    { key: "callingCode", icon: Phone, value: country.callingCode || t("unknown") },
    { key: "timezones", icon: Clock, value: country.timezones.length ? country.timezones.join(", ") : t("unknown") },
    { key: "capital", icon: Landmark, value: country.capital ?? t("unknown") },
    {
      key: "region",
      icon: Globe,
      value: country.subregion
        ? `${regionName(country.subregion)}, ${regionName(country.region)}`
        : regionName(country.region),
    },
  ];

  /** Regions come from the dataset in English; translate the ones we know. */
  function regionName(name: string): string {
    const key = `regions.${name.toLowerCase().replace(/[^a-z]+/g, "_")}`;
    return t.has(key) ? t(key) : name;
  }

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <Link href="/know-before" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        {t("backToList")}
      </Link>

      <header className="mt-4 flex items-center gap-4">
        <CountryFlag code={country.code} size={48} />
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">
            {name}
            {local && (
              <span className="ms-3 text-xl font-normal text-muted-foreground" dir="auto">
                / {local}
              </span>
            )}
          </h1>
          {demo && <Badge variant="secondary" className="mt-2">{t("demoBadge")}</Badge>}
        </div>
      </header>

      <section className="mt-10" aria-labelledby="facts-title">
        <h2 id="facts-title" className="text-xl font-semibold">
          {t("facts")}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {facts.map(({ key, icon: Icon, value }) => (
            <div key={key} className="flex gap-3 rounded-xl border bg-card p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-sm text-muted-foreground">{t(key)}</dt>
                <dd className="font-medium" dir="auto">
                  {value}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="practical-title">
        <h2 id="practical-title" className="text-xl font-semibold">
          {t("practical")}
        </h2>
        {extras ? (
          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Fact icon={Plug} label={t("plug")}>
              {t("plugValue", { types: extras.plugTypes.join(" / "), voltage: extras.voltage, frequency: extras.frequency })}
            </Fact>
            <Fact icon={Siren} label={t("emergency")}>
              <span className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span>{t("emergencyGeneral")}</span><span className="font-semibold tabular-nums">{extras.emergency.general}</span>
                <span>{t("police")}</span><span className="font-semibold tabular-nums">{extras.emergency.police}</span>
                <span>{t("ambulance")}</span><span className="font-semibold tabular-nums">{extras.emergency.ambulance}</span>
                <span>{t("fire")}</span><span className="font-semibold tabular-nums">{extras.emergency.fire}</span>
              </span>
            </Fact>
            <Fact icon={Droplets} label={t("tapWater")}>
              {extras.tapWaterSafe === null ? t("tapWaterUnknown") : extras.tapWaterSafe ? t("tapWaterYes") : t("tapWaterNo")}
            </Fact>
            {extras.tippingNote && (
              <Fact icon={HandCoins} label={t("tipping")}>
                {extras.tippingNote[uiLocale] ?? extras.tippingNote.en}
              </Fact>
            )}
          </dl>
        ) : (
          <Card className="mt-4 border-dashed">
            <CardContent className="pt-6 text-sm text-muted-foreground">{t("extrasOnlyDemo")}</CardContent>
          </Card>
        )}
      </section>

      <section className="mt-10" aria-labelledby="official-title">
        <h2 id="official-title" className="text-xl font-semibold">
          {t("official")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("officialNote")}</p>
        <ul className="mt-4 space-y-2">
          {officialLinks.map(({ key, href }) => (
            <li key={key}>
              <ExternalLink href={href}>{t(key)}</ExternalLink>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 border-t pt-4 text-xs text-muted-foreground">
        <p>
          <span className="font-medium">{t("sources")}:</span> {t("sourcesText")}
        </p>
        {extras && (
          <ul className="mt-1 flex flex-wrap gap-x-3">
            {extras.sources.map((s) => (
              <li key={s}>
                <a href={s} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  {new URL(s).hostname}
                </a>
              </li>
            ))}
          </ul>
        )}
      </footer>
    </article>
  );
}

function Fact({ icon: Icon, label, children }: { icon: typeof Coins; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunset/15 text-sunset">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}

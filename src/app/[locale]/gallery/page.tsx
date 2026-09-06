import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarDays, Footprints, MapPin, Users } from "lucide-react";
import { routing } from "@/i18n/routing";
import { CountryFlag } from "@/components/country-flag";
import { Badge } from "@/components/ui/badge";
import { CloneTemplateButton } from "@/components/gallery/clone-template-button";
import { getCountriesLite } from "@/lib/data/countries-lite";
import { listTemplateSummaries } from "@/lib/templates/server";
import { PageMessages } from "@/i18n/page-messages";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return { title: t("title") };
}

/** Ready-made plans to copy and adapt. Static data, no database needed. */
export default async function GalleryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const t = await getTranslations("gallery");
  const tw = await getTranslations("wizard");
  const tt = (key: string) => (t.has(key as never) ? t(key as never) : key);
  const countries = new Map(getCountriesLite(uiLocale).map((c) => [c.code, c.name]));
  const templates = listTemplateSummaries();

  return (
    <PageMessages namespaces={["gallery"]}>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
        {templates.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {templates.map((tpl) => (
              <li key={tpl.id} className="flex flex-col gap-3 rounded-md border bg-card p-5">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1 rtl:space-x-reverse">
                    {tpl.countries.map((code) => (
                      <CountryFlag key={code} code={code} size={24} />
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold">{tt(`templates.${tpl.id}.title`)}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{tt(`templates.${tpl.id}.body`)}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("countries")}</dt>
                    <dd>{tpl.countries.map((c) => countries.get(c) ?? c).join(", ")}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("days")}</dt>
                    <dd>{tw("dates.daysValue", { count: tpl.days })}</dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("party")}</dt>
                    <dd>
                      {tw("summary.people", { count: tpl.adults })}
                      {tpl.children > 0 && `, ${tw("summary.childrenCount", { count: tpl.children })}`}
                    </dd>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Footprints className="size-4 text-muted-foreground" aria-hidden />
                    <dt className="sr-only">{t("places")}</dt>
                    <dd>{t("placesCount", { count: tpl.places })}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{tw(`pace.options.${tpl.effort}.title`)}</Badge>
                  <Badge variant="secondary">{tw(`budget.levels.${tpl.budget}.title`)}</Badge>
                </div>
                <div className="mt-auto pt-2">
                  <CloneTemplateButton id={tpl.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-xs text-muted-foreground">{t("note")}</p>
      </div>
    </PageMessages>
  );
}

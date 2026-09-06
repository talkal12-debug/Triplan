import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CloudOff, Eye, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

type Props = { params: Promise<{ locale: string }> };

const features = [
  { key: "fit", icon: Users },
  { key: "honest", icon: Eye },
  { key: "offline", icon: CloudOff },
] as const;

const steps = ["1", "2", "3"] as const;

/**
 * Home: an editorial front page. One strong headline in the display face, a brass
 * hairline, the three steps as a table of contents, features as three columns
 * separated by hairlines. No gradients, no glow, no cards for their own sake.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="grid gap-12 pt-14 pb-16 sm:pt-20 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="lg:col-span-8">
          <p className="eyebrow eyebrow-rule">{t("eyebrow")}</p>
          <h1 className="mt-6 max-w-3xl text-balance font-display text-5xl leading-[1.04] tracking-tight sm:text-6xl md:text-7xl">
            {t("heroTitle")}
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">{t("heroSubtitle")}</p>
          <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
            <Button asChild size="lg" className="h-12 px-7 text-base">
              <Link href="/plan">
                {t("cta")}
                <ArrowRight className="rtl:-scale-x-100" aria-hidden />
              </Link>
            </Button>
            <Link
              href="/gallery"
              className="group inline-flex items-center gap-2 border-b border-foreground/40 pb-0.5 text-base text-foreground transition-colors hover:border-sunset"
            >
              {t("ctaSecondary")}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>

        {/* Table of contents: the three steps */}
        <ol className="rule-brass lg:col-span-4" aria-label={t("howTitle")}>
          {steps.map((step, i) => (
            <FadeIn key={step} delay={i * 0.08} as="li" className="flex gap-5 border-b border-foreground/10 py-5">
              <span aria-hidden className="numeral w-10 shrink-0 text-3xl leading-none text-sunset">
                0{step}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-xl leading-snug">{t(`steps.${step}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`steps.${step}.body`)}</p>
              </div>
            </FadeIn>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="rule-brass py-16" aria-labelledby="features-title">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="features-title" className="font-display text-3xl tracking-tight sm:text-4xl">
            {t("featuresTitle")}
          </h2>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-y-10 sm:grid-cols-3 sm:gap-x-10 sm:divide-x sm:divide-foreground/10 rtl:sm:divide-x-reverse">
          {features.map(({ key, icon: Icon }, i) => (
            <FadeIn key={key} delay={i * 0.08} className="sm:ps-10 sm:first:ps-0">
              <Icon className="size-5 text-sunset" aria-hidden strokeWidth={1.5} />
              <h3 className="mt-5 font-display text-2xl leading-snug">{t(`features.${key}.title`)}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-muted-foreground">{t(`features.${key}.body`)}</p>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Status */}
      <section className="rule-brass py-10">
        <p className="eyebrow">{t("statusTitle")}</p>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t("statusBody")}</p>
      </section>
    </div>
  );
}

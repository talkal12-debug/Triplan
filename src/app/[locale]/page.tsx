import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, CloudOff, Eye, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion/fade-in";

type Props = { params: Promise<{ locale: string }> };

const features = [
  { key: "fit", icon: Users },
  { key: "honest", icon: Eye },
  { key: "offline", icon: CloudOff },
] as const;

const steps = ["1", "2", "3"] as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-gradient px-6 py-16 text-center sm:px-12 sm:py-24 mt-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -end-24 -top-24 hidden size-72 rounded-full bg-sunset/30 blur-3xl sm:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -start-24 hidden size-72 rounded-full bg-primary/30 blur-3xl sm:block"
        />
        <div className="relative mx-auto max-w-2xl">
          <Badge variant="secondary" className="mb-4">
            {t("eyebrow")}
          </Badge>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-muted-foreground">
            {t("heroSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link href="/plan">
                {t("cta")}
                <ArrowRight className="rtl:-scale-x-100" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link href="/gallery">{t("ctaSecondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16" aria-labelledby="features-title">
        <h2 id="features-title" className="text-center text-2xl font-semibold sm:text-3xl">
          {t("featuresTitle")}
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map(({ key, icon: Icon }, i) => (
            <FadeIn key={key} delay={i * 0.08}>
              <Card className="h-full rounded-2xl">
                <CardContent className="flex h-full flex-col gap-3 pt-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold">{t(`features.${key}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t(`features.${key}.body`)}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="pb-16" aria-labelledby="how-title">
        <h2 id="how-title" className="text-center text-2xl font-semibold sm:text-3xl">
          {t("howTitle")}
        </h2>
        <ol className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step} delay={i * 0.08} as="li" className="flex gap-4">
                <span
                  aria-hidden
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-sunset font-semibold text-sunset-foreground"
                >
                  {step}
                </span>
                <div>
                  <h3 className="font-semibold">{t(`steps.${step}.title`)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t(`steps.${step}.body`)}
                  </p>
                </div>
            </FadeIn>
          ))}
        </ol>
      </section>

      {/* Status */}
      <section className="pb-16">
        <Card className="rounded-2xl border-dashed">
          <CardContent className="pt-6">
            <h2 className="font-semibold">{t("statusTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("statusBody")}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

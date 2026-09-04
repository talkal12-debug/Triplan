import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDemoLoginEnabled, isGoogleEnabled } from "@/lib/auth/magic-link";
import { SignInForm } from "@/components/auth/sign-in-form";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ callbackUrl?: string; error?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("title") };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { callbackUrl, error } = await searchParams;
  const session = await auth();
  const target = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : `/${locale}/trips`;
  if (session?.user) redirect(target);
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-8">
        <SignInForm google={isGoogleEnabled()} demoLink={isDemoLoginEnabled()} callbackUrl={target} hadError={Boolean(error)} />
      </div>
    </div>
  );
}

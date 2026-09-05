import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { baseNamespaces, pickMessages } from "@/i18n/page-messages";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { localeDir } from "@/lib/i18n/locales";
import { Providers } from "@/components/layout/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { DemoBanner } from "@/components/layout/demo-banner";
import "../globals.css";

// Rubik covers Hebrew, Latin, Arabic and Cyrillic with one consistent design.
// CJK and Devanagari (zh-CN, ja, hi) fall through to the system fonts listed in globals.css.
const rubik = Rubik({
  subsets: ["latin", "latin-ext", "hebrew", "arabic", "cyrillic"],
  variable: "--font-rubik",
  // "optional": if the font is not ready within ~100 ms the system font stays for this page view,
  // so text never reflows (no layout shift). The file is cached, so the next page gets Rubik.
  display: "optional",
  // No preload of all five subsets: unicode-range lets the browser fetch only the scripts on the page.
  preload: false,
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: { default: t("appName"), template: `%s · ${t("appName")}` },
    description: t("tagline"),
    applicationName: t("appName"),
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: t("appName") },
    icons: {
      icon: [
        { url: "/icons/icon.svg", type: "image/svg+xml" },
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#161a22" },
  ],
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const dir = localeDir[locale];
  const t = await getTranslations("common");
  // Only the namespaces the shell needs go to the client here; pages add their own (see page-messages.tsx).
  const shellMessages = pickMessages(await getMessages(), baseNamespaces);

  return (
    <html
      lang={locale}
      dir={dir}
      className={rubik.variable}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col bg-background text-foreground antialiased">
        <NextIntlClientProvider messages={shellMessages}>
          <Providers dir={dir}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              {t("skipToContent")}
            </a>
            <DemoBanner />
            <Header />
            <main id="main" className="flex-1 pb-20 md:pb-0">
              {children}
            </main>
            <Footer />
            <MobileNav />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

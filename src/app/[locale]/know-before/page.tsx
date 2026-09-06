import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { countries, countryName, isDemoCountry } from "@/lib/data/countries";
import { CountryFilter } from "@/components/know-before/country-filter";
import { PageMessages } from "@/i18n/page-messages";

type Props = { params: Promise<{ locale: string }> };

/** Countries rendered before "show all": enough to fill a phone screen twice. */
const INITIAL_ROWS = 24;

type Row = { code: string; name: string; local: string | null; search: string; demo: boolean };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "knowBefore" });
  return { title: t("title"), description: t("subtitle") };
}

/**
 * Country index. The 250 rows are server-rendered plain anchors (nothing to
 * hydrate); only the search box is a client component and filters them by
 * their data-search attribute.
 */
export default async function KnowBeforeIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("knowBefore");
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const collator = new Intl.Collator(uiLocale);

  const rows: Row[] = countries
    .map((c) => {
      const name = countryName(c, uiLocale);
      const local = c.names.local && c.names.local !== name ? c.names.local : null;
      return {
        code: c.code,
        name,
        local,
        search: [name, local, c.names.en].filter(Boolean).join("|").toLowerCase(),
        demo: isDemoCountry(c.code),
      };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
  const demo = rows.filter((r) => r.demo);
  const rest = rows.filter((r) => !r.demo);

  // 250 rows as one HTML string: the React tree of a list this size costs more to serialise into
  // the RSC payload and to parse on a phone than the rows are worth. Same markup as CountryFlag/Badge.
  // Rows after the first INITIAL_ROWS are hidden until "show all" or a search (hidden rows cost no layout).
  const demoBadge = `<span class="inline-flex h-5 shrink-0 items-center justify-center rounded-md border border-transparent bg-secondary px-2 text-xs font-medium text-secondary-foreground">${escapeHtml(t("demoBadge"))}</span>`;
  const rowHtml = (c: Row, hidden: boolean) => {
    const cc = c.code.toLowerCase();
    return (
      `<li data-search="${escapeHtml(c.search)}"${hidden ? " data-more hidden" : ""}><a href="/${uiLocale}/know-before/${cc}" class="flex min-h-14 items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 outline-none">` +
      `<img src="/flags/h24/${cc}.png" width="32" height="24" alt="" loading="lazy" decoding="async" class="shrink-0 rounded-sm object-contain drop-shadow-xs" style="width:32px;height:24px">` +
      `<span class="min-w-0 flex-1"><span class="block truncate font-medium">${escapeHtml(c.name)}</span>` +
      (c.local ? `<span class="block truncate text-xs text-muted-foreground" dir="auto">${escapeHtml(c.local)}</span>` : "") +
      `</span>${c.demo ? demoBadge : ""}</a></li>`
    );
  };
  const grid = (items: Row[], initial: number) => (
    <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" dangerouslySetInnerHTML={{ __html: items.map((c, i) => rowHtml(c, i >= initial)).join("") }} />
  );

  return (
    <PageMessages namespaces={["knowBefore"]}>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-8">
          <CountryFilter total={rows.length} initiallyShown={demo.length + Math.min(INITIAL_ROWS, rest.length)} />
          <section className="mt-6" aria-labelledby="demo-title" data-country-section>
            <h2 id="demo-title" className="text-lg font-semibold">
              {t("demoTitle")}
            </h2>
            {grid(demo, demo.length)}
          </section>
          <section className="mt-8" aria-labelledby="all-title" data-country-section>
            <h2 id="all-title" className="text-lg font-semibold">
              {t("allTitle")}
            </h2>
            {grid(rest, INITIAL_ROWS)}
          </section>
        </div>
      </div>
    </PageMessages>
  );
}

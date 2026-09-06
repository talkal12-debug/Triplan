import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { affiliateIdsFromEnv, affiliateProviders, type AffiliateProvider } from "@/lib/providers/affiliate";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "disclosure" });
  return { title: t("title") };
}

const kinds: Record<AffiliateProvider, "hotel" | "ticket" | "flight" | "car" | "event"> = {
  booking: "hotel",
  hotelscom: "hotel",
  agoda: "hotel",
  hostelworld: "hotel",
  getyourguide: "ticket",
  viator: "ticket",
  tiqets: "ticket",
  klook: "ticket",
  kiwi: "flight",
  skyscanner: "flight",
  rentalcars: "car",
  discovercars: "car",
  ticketmaster: "event",
  eventbrite: "event",
  songkick: "event",
  residentadvisor: "event",
};

/** Which partners currently carry a tracking id (server-side env), so the page tells the truth. */
function activePrograms(): Set<AffiliateProvider> {
  const ids = affiliateIdsFromEnv();
  const active = new Set<AffiliateProvider>(Object.keys(ids.query ?? {}) as AffiliateProvider[]);
  if (ids.bookingAid) active.add("booking");
  if (ids.getYourGuidePartnerId) active.add("getyourguide");
  if (ids.viatorPid) active.add("viator");
  if (ids.tiqetsPartner) active.add("tiqets");
  if (ids.klookAid) active.add("klook");
  if (ids.kiwiAffilId) active.add("kiwi");
  return active;
}

export default async function DisclosurePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("disclosure");
  const tl = await getTranslations("plan.links");
  const active = activePrograms();
  const groups = ["hotel", "flight", "car", "ticket", "event"] as const;

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <div className="mt-6 space-y-4 leading-relaxed text-muted-foreground">
        <p>{t("intro")}</p>
        <p>{t("affiliate")}</p>
        <p>{t("marking")}</p>
        <p>{t("data")}</p>
        {active.size === 0 && <p className="rounded-md border border-dashed p-4 text-sm">{t("noKeys")}</p>}
      </div>

      <section className="mt-10" aria-labelledby="partners-title">
        <h2 id="partners-title" className="text-xl font-semibold">
          {t("partners")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("partnersIntro")}</p>
        {groups.map((kind) => (
          <div key={kind} className="mt-6">
            <h3 className="font-medium">{t(`kinds.${kind}`)}</h3>
            <ul className="mt-2 space-y-2">
              {affiliateProviders
                .filter((p) => kinds[p] === kind)
                .map((p) => (
                  <li key={p} className="rounded-md border bg-card p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{tl(p)}</span>
                      <span className="text-xs text-muted-foreground">{active.has(p) ? t("statusAffiliate") : t("statusPlain")}</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{tl(`about.${p}`)}</p>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>
    </article>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { AffiliateLink } from "@/lib/providers/affiliate";
import { cn } from "@/lib/utils";

type Props = {
  links: AffiliateLink[];
  label?: string;
  className?: string;
  size?: "sm" | "xs";
  /** Show a collapsible "about these sites" block with one line per partner. */
  about?: boolean;
};

/**
 * Outbound booking links. Every one opens in a new tab with rel="sponsored"
 * and is labelled as an affiliate link when an id is attached (see /disclosure).
 * Each link deep-links into the partner's search for the trip's city and dates.
 */
export function AffiliateLinks({ links, label, className, size = "sm", about = false }: Props) {
  const t = useTranslations("plan.links");
  const tc = useTranslations("common");
  if (links.length === 0) return null;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {label && <span className={cn("text-muted-foreground", size === "xs" ? "text-xs" : "text-sm")}>{label}</span>}
        {links.map((l) => (
          <a
            key={l.provider}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 font-medium transition-colors hover:border-primary/40 hover:bg-muted",
              size === "xs" ? "text-[11px]" : "text-xs",
            )}
            title={`${t(`about.${l.provider}`)} · ${l.affiliate ? `${tc("affiliate")} · ` : ""}${t("opens")}`}
          >
            {t(l.provider)}
            <ExternalLink className="size-3" aria-hidden />
            <span className="sr-only">
              {t("opens")}
              {l.affiliate ? `, ${tc("affiliate")}` : ""}
            </span>
            {l.affiliate && <span className="text-[9px] uppercase text-muted-foreground">{tc("affiliate")}</span>}
          </a>
        ))}
      </div>
      {about && <AffiliateAbout links={links} />}
    </div>
  );
}

/** Collapsible one-liner per partner ("what is this site?") with a link to the disclosure page. */
export function AffiliateAbout({ links, className }: { links: AffiliateLink[]; className?: string }) {
  const t = useTranslations("plan.links");
  const providers = links.map((l) => l.provider).filter((p, i, all) => all.indexOf(p) === i);
  if (providers.length === 0) return null;
  return (
    <details className={cn("text-xs text-muted-foreground", className)} onClick={(e) => e.stopPropagation()}>
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded-full border border-dashed bg-card px-3 py-1 text-xs font-medium text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden">
        <Info className="size-3.5 text-primary" aria-hidden />
        {t("aboutTitle")}
      </summary>
      <ul className="mt-1.5 space-y-1 ps-5">
        {providers.map((p) => (
          <li key={p}>
            <span className="font-medium text-foreground">{t(p)}</span>: {t(`about.${p}`)}
          </li>
        ))}
        <li>
          <Link href="/disclosure" className="underline underline-offset-4 hover:text-foreground">
            {t("aboutMore")}
          </Link>
        </li>
      </ul>
    </details>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import type { AffiliateLink } from "@/lib/providers/affiliate";
import { cn } from "@/lib/utils";

type Props = { links: AffiliateLink[]; label?: string; className?: string; size?: "sm" | "xs" };

/**
 * Outbound booking links. Every one opens in a new tab with rel="sponsored"
 * and is labelled as an affiliate link when an id is attached (see /disclosure).
 */
export function AffiliateLinks({ links, label, className, size = "sm" }: Props) {
  const t = useTranslations("plan.links");
  const tc = useTranslations("common");
  if (links.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
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
          title={l.affiliate ? `${tc("affiliate")} · ${t("opens")}` : t("opens")}
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
  );
}

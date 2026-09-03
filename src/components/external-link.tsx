import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Plain outbound link (official sources, websites). Affiliate links do NOT use
 * this: they go through buildAffiliateLink() and carry rel="sponsored" (milestone 6).
 */
export async function ExternalLink({ href, children, className }: Props) {
  const t = await getTranslations("common");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
      <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">({t("opensInNewTab")})</span>
    </a>
  );
}

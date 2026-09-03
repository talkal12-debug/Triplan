import { getTranslations } from "next-intl/server";
import { FlaskConical } from "lucide-react";
import { isDemoMode } from "@/lib/env";

/** Shown whenever the app runs without any external API key. */
export async function DemoBanner() {
  if (!isDemoMode()) return null;
  const t = await getTranslations("common");
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-sunset/15 px-4 py-1.5 text-center text-xs text-foreground"
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>{t("demoBanner")}</span>
    </div>
  );
}

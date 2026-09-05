import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>{t("rights", { year })}</p>
        <p>{t("madeWith")}</p>
        <Link href="/disclosure" prefetch={false} className="underline-offset-4 hover:underline">
          {tn("disclosure")}
        </Link>
      </div>
    </footer>
  );
}

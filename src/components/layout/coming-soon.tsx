import { getTranslations } from "next-intl/server";
import { Construction } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

type Props = { title: string; description: string };

/** Placeholder page body used until a section is built. */
export async function ComingSoon({ title, description }: Props) {
  const t = await getTranslations("common");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <span className="grid size-16 place-items-center rounded-2xl bg-sunset/15 text-sunset">
        <Construction className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("comingSoonBody")}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/">{t("backHome")}</Link>
      </Button>
    </div>
  );
}

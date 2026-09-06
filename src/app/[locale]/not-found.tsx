import { useTranslations } from "next-intl";
import { MapPinOff } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  const t = useTranslations("notFound");
  const tc = useTranslations("common");
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <span className="grid size-16 place-items-center rounded-md bg-muted text-muted-foreground">
        <MapPinOff className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-bold">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("body")}</p>
      <Button asChild variant="outline" className="mt-8">
        <Link href="/">{tc("backHome")}</Link>
      </Button>
    </div>
  );
}

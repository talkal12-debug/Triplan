"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isLocale, localeNames, locales, type Locale } from "@/lib/i18n/locales";
import { isUnitSystem, unitSystems } from "@/lib/units/store";
import { useUnits } from "@/lib/units/use-distance";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const tu = useTranslations("units");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { units, setUnits } = useUnits();

  function onSelect(next: string) {
    if (!isLocale(next) || next === locale) return;
    // Re-render the same path under the new locale, keeping dynamic params.
    router.replace(
      // @ts-expect-error -- params are inferred per route; pathname + params is always valid here.
      { pathname, params },
      { locale: next },
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label={`${t("switch")}. ${t("current", { name: localeNames[locale as Locale] })}`}
        >
          <Languages className="size-5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[80dvh] min-w-48 overflow-y-auto">
        <DropdownMenuLabel>{t("switch")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={onSelect}>
          {locales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} lang={code}>
              {localeNames[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{tu("label")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={units} onValueChange={(v) => isUnitSystem(v) && setUnits(v)}>
          {unitSystems.map((system) => (
            <DropdownMenuRadioItem key={system} value={system}>
              {tu(system)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "@/lib/i18n/locales";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Always prefix so /he and /en are explicit and shareable.
  localePrefix: "always",
});

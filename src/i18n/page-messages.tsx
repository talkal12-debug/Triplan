import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Message namespaces every page's client components may use (header, menus,
 * footer, sign-in state). Everything else is sent per page through
 * <PageMessages>, so a locale's whole 50 KB catalogue is not inlined into every
 * HTML document. Server components are unaffected: getTranslations sees it all.
 */
export const baseNamespaces = ["common", "nav", "theme", "locale", "units", "auth", "notFound"] as const;

export function pickMessages(all: AbstractIntlMessages, namespaces: readonly string[]): AbstractIntlMessages {
  const out: AbstractIntlMessages = {};
  for (const ns of namespaces) if (ns in all) out[ns] = all[ns];
  return out;
}

type Props = { namespaces: readonly string[]; children: React.ReactNode };

/** Adds page-specific namespaces (on top of the base ones) for the client components below. */
export async function PageMessages({ namespaces, children }: Props) {
  const all = await getMessages();
  return <NextIntlClientProvider messages={pickMessages(all, [...baseNamespaces, ...namespaces])}>{children}</NextIntlClientProvider>;
}

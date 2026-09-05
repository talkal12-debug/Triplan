"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import * as Direction from "@radix-ui/react-direction";
import type { TextDirection } from "@/lib/i18n/locales";
import { TripSync } from "@/components/auth/trip-sync";

type Props = { dir: TextDirection; children: React.ReactNode };

export function Providers({ dir, children }: Props) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* No initial session: pages stay static and the session is fetched after mount. */}
      <SessionProvider refetchOnWindowFocus={false}>
        <TripSync />
        <Direction.Provider dir={dir}>{children}</Direction.Provider>
      </SessionProvider>
    </ThemeProvider>
  );
}

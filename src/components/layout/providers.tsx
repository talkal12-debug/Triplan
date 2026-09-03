"use client";

import { ThemeProvider } from "next-themes";
import { Direction } from "radix-ui";
import type { TextDirection } from "@/lib/i18n/locales";

type Props = { dir: TextDirection; children: React.ReactNode };

export function Providers({ dir, children }: Props) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Direction.Provider dir={dir}>{children}</Direction.Provider>
    </ThemeProvider>
  );
}

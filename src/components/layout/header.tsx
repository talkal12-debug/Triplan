"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Compass, Menu } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { navItems, isActivePath } from "./nav-items";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "@/components/auth/user-menu";

export function Header() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Compass className="size-5" aria-hidden />
          </span>
          <span>{tc("appName")}</span>
        </Link>

        <nav aria-label={t("mainNav")} className="hidden items-center gap-1 md:flex">
          {navItems.map(({ href, key }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                  active ? "bg-muted text-foreground" : "text-muted-foreground",
                )}
              >
                {t(key)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <UserMenu />
          <LocaleSwitcher />
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-11 md:hidden"
                aria-label={t("openMenu")}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="end" className="w-72">
              <SheetHeader>
                <SheetTitle>{t("menuTitle")}</SheetTitle>
              </SheetHeader>
              <nav aria-label={t("mainNav")} className="flex flex-col gap-1 px-4">
                {navItems.map(({ href, key, icon: Icon }) => {
                  const active = isActivePath(pathname, href);
                  return (
                    <Link
                      key={key}
                      href={href}
                      prefetch={false}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-muted",
                        active ? "bg-muted text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {t(key)}
                    </Link>
                  );
                })}
                <Link
                  href="/disclosure"
                  onClick={() => setOpen(false)}
                  className="mt-2 min-h-11 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  {t("disclosure")}
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

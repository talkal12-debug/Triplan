"use client";

import { useTranslations } from "next-intl";
import { signOut, useSession } from "next-auth/react";
import { LogIn, LogOut, Luggage, UserRound } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Header slot: "sign in" link for guests, avatar menu for members. */
export function UserMenu() {
  const t = useTranslations("auth");
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") return <span className="size-11" aria-hidden />;

  if (!session?.user) {
    return (
      <Button asChild variant="ghost" size="icon" className="size-11">
        <Link href={{ pathname: "/signin", query: { callbackUrl: pathname } }} aria-label={t("signIn")}>
          <LogIn className="size-5" aria-hidden />
        </Link>
      </Button>
    );
  }

  const label = session.user.name || session.user.email || "";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11" aria-label={t("account")}>
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar from the identity provider
            <img src={session.user.image} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initial}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground" dir="ltr">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/trips">
            <Luggage aria-hidden />
            {t("myTrips")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound aria-hidden />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ callbackUrl: window.location.pathname })}>
          <LogOut aria-hidden />
          {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

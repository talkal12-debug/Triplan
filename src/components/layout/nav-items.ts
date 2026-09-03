import { BookOpenCheck, Compass, Home, LayoutGrid, Luggage } from "lucide-react";

/** Primary navigation. The first three also form the mobile bottom bar. */
export const navItems = [
  { href: "/", key: "home", icon: Home },
  { href: "/plan", key: "plan", icon: Compass },
  { href: "/trips", key: "myTrips", icon: Luggage },
  { href: "/know-before", key: "knowBefore", icon: BookOpenCheck },
  { href: "/gallery", key: "gallery", icon: LayoutGrid },
] as const;

export const mobileNavItems = navItems.slice(0, 3);

export type NavKey = (typeof navItems)[number]["key"];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

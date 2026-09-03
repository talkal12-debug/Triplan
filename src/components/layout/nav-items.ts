import { Compass, Home, LayoutGrid } from "lucide-react";

/** Primary navigation, shared by the header and the mobile bottom bar. */
export const navItems = [
  { href: "/", key: "home", icon: Home },
  { href: "/plan", key: "plan", icon: Compass },
  { href: "/gallery", key: "gallery", icon: LayoutGrid },
] as const;

export type NavKey = (typeof navItems)[number]["key"];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

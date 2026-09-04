import "server-only";
import { auth } from "@/auth";

export type CurrentUser = { id: string; email: string | null; name: string | null; image: string | null };

/** The signed-in user, or null for guests. Safe to call from route handlers and server components. */
export async function currentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? null, name: u.name ?? null, image: u.image ?? null };
}

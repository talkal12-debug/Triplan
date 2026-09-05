import { randomBytes } from "node:crypto";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isDemoLoginEnabled, isGoogleEnabled, rememberDemoLink, sendWithResend } from "@/lib/auth/magic-link";

/**
 * Auth.js v5. Providers switch themselves on by environment:
 * - Google when AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET exist
 * - Email magic link always: delivered by Resend with AUTH_RESEND_KEY,
 *   otherwise shown on screen (demo mode, see magic-link.ts)
 * Sessions live in the database (Session table) so sign-out is server-side.
 */
const env = getEnv();

function fallbackSecret(): string {
  if (env.NODE_ENV !== "production") return "triplan-dev-secret-not-for-production";
  console.warn("[auth] AUTH_SECRET is not set: using a random secret, sessions will not survive a restart.");
  return randomBytes(32).toString("hex");
}

const providers: Provider[] = [
  {
    id: "email",
    type: "email",
    name: "Email",
    from: env.AUTH_EMAIL_FROM ?? "Triplan <onboarding@resend.dev>",
    maxAge: 24 * 60 * 60,
    options: {},
    async sendVerificationRequest({ identifier, url }) {
      if (env.AUTH_RESEND_KEY) {
        await sendWithResend(env.AUTH_RESEND_KEY, identifier, url, "Triplan");
        return;
      }
      if (isDemoLoginEnabled()) {
        rememberDemoLink(identifier, url);
        console.info(`[auth] demo magic link for ${identifier}: ${url}`);
        return;
      }
      throw new Error("No email provider configured (set AUTH_RESEND_KEY)");
    },
  },
];
if (isGoogleEnabled()) {
  providers.push(Google({ clientId: env.AUTH_GOOGLE_ID, clientSecret: env.AUTH_GOOGLE_SECRET }));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers,
  session: { strategy: "database" },
  // Production should set AUTH_SECRET. Without it the app still runs (guest mode must never break):
  // a random per-process secret is used, so sessions simply do not survive a restart.
  secret: env.AUTH_SECRET ?? fallbackSecret(),
  trustHost: true,
  pages: { signIn: "/he/signin", verifyRequest: "/he/signin?sent=1", error: "/he/signin" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

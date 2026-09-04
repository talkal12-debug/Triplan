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
  // Production must set AUTH_SECRET; development gets a stable fallback so the app runs with zero config.
  secret: env.AUTH_SECRET ?? (env.NODE_ENV === "production" ? undefined : "triplan-dev-secret-not-for-production"),
  trustHost: true,
  pages: { signIn: "/he/signin", verifyRequest: "/he/signin?sent=1", error: "/he/signin" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

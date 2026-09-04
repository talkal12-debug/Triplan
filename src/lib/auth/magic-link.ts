import "server-only";
import { getEnv } from "@/lib/env";

/**
 * Delivery of the sign-in link.
 *
 * With AUTH_RESEND_KEY the link is emailed through Resend. Without it, the app
 * still has to work (Definition of Done: no keys), so the link is kept in memory
 * and handed back to the sign-in page, which shows an "open the link" button.
 * That demo path is only enabled outside production, or when AUTH_DEMO_LOGIN=true
 * is set on purpose, because it lets anyone sign in as any address.
 */
export function isDemoLoginEnabled(): boolean {
  const env = getEnv();
  if (env.AUTH_RESEND_KEY) return false;
  return env.NODE_ENV !== "production" || env.AUTH_DEMO_LOGIN === "true";
}

export function isGoogleEnabled(): boolean {
  const env = getEnv();
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

type Pending = { url: string; createdAt: number };
const store = globalThis as unknown as { __triplanMagicLinks?: Map<string, Pending> };
const links = (store.__triplanMagicLinks ??= new Map<string, Pending>());
const TTL_MS = 15 * 60 * 1000;

export function rememberDemoLink(email: string, url: string) {
  links.set(email.toLowerCase(), { url, createdAt: Date.now() });
}

export function takeDemoLink(email: string): string | null {
  const key = email.toLowerCase();
  const hit = links.get(key);
  if (!hit) return null;
  if (Date.now() - hit.createdAt > TTL_MS) {
    links.delete(key);
    return null;
  }
  return hit.url;
}

/** Sends the email through Resend's HTTP API (no SDK needed). */
export async function sendWithResend(apiKey: string, to: string, url: string, appName: string) {
  const from = getEnv().AUTH_EMAIL_FROM ?? "Triplan <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: `${appName}: sign in`,
      text: `Sign in to ${appName}:\n\n${url}\n\nIf you did not request this email, ignore it.`,
      html: `<p>Sign in to <strong>${appName}</strong>:</p><p><a href="${url}">${url}</a></p><p style="color:#666">If you did not request this email, ignore it.</p>`,
    }),
  });
  if (!res.ok) {
    throw new Error(`resend: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

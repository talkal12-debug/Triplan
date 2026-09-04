"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { KeyRound, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/wizard/controls";

type Props = {
  google: boolean;
  demoLink: boolean;
  callbackUrl: string;
  hadError?: boolean;
};

/**
 * Email magic link (always) + Google (when configured).
 * In demo mode (no email service) the link comes back from /api/auth/demo-link
 * and is shown as a button, so the whole flow works without any key.
 */
export function SignInForm({ google, demoLink, callbackUrl, hadError }: Props) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [demoUrl, setDemoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(hadError ? t("error") : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await signIn("email", { email, redirect: false, callbackUrl });
      if (res?.error) {
        setError(t("error"));
        setState("idle");
        return;
      }
      if (demoLink) {
        const r = await fetch(`/api/auth/demo-link?email=${encodeURIComponent(email)}`);
        if (r.ok) setDemoUrl(((await r.json()) as { url: string }).url);
      }
      setState("sent");
    } catch {
      setError(t("error"));
      setState("idle");
    }
  }

  return (
    <div className="space-y-6">
      {state === "sent" ? (
        <div className="rounded-2xl border bg-card p-5" role="status">
          <p className="font-medium">{t("sent")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{demoUrl ? t("demoNote") : t("sentBody", { email })}</p>
          {demoUrl && (
            <Button asChild className="mt-4">
              <a href={demoUrl}>
                <KeyRound aria-hidden />
                {t("demoOpen")}
              </a>
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="signin-email" className="block text-sm font-medium">
            {t("email")}
          </label>
          <input
            id="signin-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            dir="ltr"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <Button type="submit" className="w-full" disabled={state === "sending"}>
            <Mail aria-hidden />
            {state === "sending" ? t("sending") : t("sendLink")}
          </Button>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

      {google && state !== "sent" && (
        <>
          <p className="text-center text-xs text-muted-foreground">{t("or")}</p>
          <Button type="button" variant="outline" className="w-full" onClick={() => signIn("google", { callbackUrl })}>
            {t("google")}
          </Button>
        </>
      )}
      <p className="text-xs text-muted-foreground" lang={locale}>
        {t("guestHint")}
      </p>
    </div>
  );
}

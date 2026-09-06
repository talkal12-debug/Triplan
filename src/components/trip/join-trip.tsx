"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { LogIn, Users } from "lucide-react";
import { z } from "zod";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { CountryFlag } from "@/components/country-flag";
import { guestTripSchema } from "@/lib/guest/schema";
import { mergeRemoteTrips } from "@/lib/guest/trips";

type Props = { token: string };

const previewSchema = z.object({ title: z.string(), ownerName: z.string().nullable(), role: z.string(), countries: z.array(z.string()) });
const joinSchema = z.object({ trip: guestTripSchema, role: z.string() });

export function JoinTrip({ token }: Props) {
  const t = useTranslations("collab");
  const ta = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const { status } = useSession();
  const [preview, setPreview] = useState<z.infer<typeof previewSchema> | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "joining" | "error">("idle");

  useEffect(() => {
    fetch(`/api/join/${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? previewSchema.parse(await r.json()) : null))
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [token]);

  async function join() {
    setState("joining");
    try {
      const res = await fetch(`/api/join/${encodeURIComponent(token)}`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const { trip } = joinSchema.parse(await res.json());
      mergeRemoteTrips([trip]);
      router.push(`/trip/${trip.id}`);
    } catch {
      setState("error");
    }
  }

  if (preview === undefined || status === "loading") return null;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 text-center sm:px-6">
      <span className="mx-auto grid size-16 place-items-center rounded-md bg-muted text-muted-foreground">
        <Users className="size-8" aria-hidden />
      </span>
      <h1 className="mt-6 text-3xl font-bold">{t("joinTitle")}</h1>
      {preview === null ? (
        <p className="mt-3 text-muted-foreground">{t("inviteInvalid")}</p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-center gap-2">
            {preview.countries.map((c) => (
              <CountryFlag key={c} code={c} size={24} />
            ))}
          </div>
          <p className="mt-3 text-muted-foreground">{t("joinBody", { owner: preview.ownerName ?? t("someone"), role: t(`roles.${preview.role === "viewer" ? "viewer" : "editor"}`) })}</p>
          {status === "authenticated" ? (
            <Button type="button" className="mt-8" onClick={join} disabled={state === "joining"}>
              {state === "joining" ? t("joining") : t("join")}
            </Button>
          ) : (
            <Button asChild className="mt-8">
              <Link href={{ pathname: "/signin", query: { callbackUrl: `/${locale}/join/${token}` } }}>
                <LogIn aria-hidden />
                {ta("signIn")}
              </Link>
            </Button>
          )}
          {state === "error" && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {t("joinError")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

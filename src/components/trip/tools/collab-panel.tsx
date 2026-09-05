"use client";

import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Check, Copy, Link2, LogIn, RefreshCw, Send, Trash2, UserMinus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { inputClass } from "@/components/wizard/controls";
import type { GuestTrip } from "@/lib/guest/trips";
import { useCollabStore } from "@/lib/collab/store";
import type { Member } from "@/lib/collab/schema";
import { placeLabel } from "@/lib/guest/plan-helpers";
import type { Locale } from "@/lib/i18n/locales";

type Props = { trip: GuestTrip };

const POLL_MS = 30_000;

function memberLabel(m: Member | undefined, fallback: string): string {
  return m?.name || m?.email || fallback;
}

/**
 * Members, invite link (owner), and comments. Votes live on the activity cards.
 * Needs an account: guests see a sign-in prompt. Polls every 30 s while open.
 */
export function CollabPanel({ trip }: Props) {
  const t = useTranslations("collab");
  const ta = useTranslations("auth");
  const tp = useTranslations("plan");
  const format = useFormatter();
  const locale = useLocale();
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const { state, load, act } = useCollabStore();
  const name = (activityId: string): string => {
    const activity = trip.plan?.itinerary.days.flatMap((d) => d.activities).find((a) => a.id === activityId);
    return activity?.placeId ? placeLabel(trip.plan?.places[activity.placeId], locale as Locale, activity.placeId) : activityId;
  };
  const [text, setText] = useState("");
  const [dayIndex, setDayIndex] = useState<number | null>(null);
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    void load(trip.id);
    const timer = setInterval(() => void load(trip.id), POLL_MS);
    return () => clearInterval(timer);
  }, [signedIn, trip.id, load]);

  if (status === "loading") return null;
  if (!signedIn) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm">
        <span>{t("needAccount")}</span>
        <Button asChild size="sm" variant="outline">
          <Link href={{ pathname: "/signin", query: { callbackUrl: `/${locale}/trip/${trip.id}` } }}>
            <LogIn aria-hidden />
            {ta("signIn")}
          </Link>
        </Button>
      </div>
    );
  }
  if (!state) return <p className="text-sm text-muted-foreground">{t("notSynced")}</p>;

  const isOwner = state.role === "owner";
  const inviteUrl = state.invite ? `${window.location.origin}/${locale}/join/${state.invite.token}` : null;
  const byId = new Map(state.members.map((m) => [m.userId, m]));

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    await act(trip.id, body);
    setBusy(false);
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await run({ action: "comment", text: text.trim(), dayIndex, activityId: null });
    setText("");
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold">{t("members")}</h3>
        <ul className="mt-2 space-y-1">
          {state.members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {memberLabel(m, "?").charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate" dir="auto">
                {memberLabel(m, m.userId)}
                {m.userId === state.me && ` (${t("you")})`}
              </span>
              <Badge variant={m.role === "owner" ? "default" : "secondary"}>{t(`roles.${m.role}`)}</Badge>
              {(isOwner && m.role !== "owner") || (m.userId === state.me && m.role !== "owner") ? (
                <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={m.userId === state.me ? t("leave") : t("remove", { name: memberLabel(m, "") })} disabled={busy} onClick={() => run({ action: "remove_member", userId: m.userId })}>
                  <UserMinus className="size-4" aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section>
          <h3 className="font-semibold">{t("invite")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("inviteHint")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm">
              <span className="me-2">{t("inviteRole")}</span>
              <select value={state.invite?.role ?? role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="h-10 rounded-lg border bg-card px-2" disabled={busy}>
                <option value="editor">{t("roles.editor")}</option>
                <option value="viewer">{t("roles.viewer")}</option>
              </select>
            </label>
            {!inviteUrl ? (
              <Button type="button" size="sm" disabled={busy} onClick={() => run({ action: "invite", role, rotate: false })}>
                <Link2 aria-hidden />
                {t("createInvite")}
              </Button>
            ) : (
              <>
                <Button type="button" size="sm" variant="outline" onClick={copy}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? t("copied") : t("copy")}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: "invite", role: state.invite?.role ?? role, rotate: true })}>
                  <RefreshCw aria-hidden />
                  {t("rotate")}
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: "revoke_invite" })}>
                  {t("revoke")}
                </Button>
              </>
            )}
          </div>
          {inviteUrl && (
            <p className="mt-2 break-all rounded-lg bg-muted px-3 py-2 text-xs" dir="ltr">
              {inviteUrl}
            </p>
          )}
        </section>
      )}

      <section>
        <h3 className="font-semibold">{t("comments")}</h3>
        {state.comments.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">{t("noComments")}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {state.comments.map((c) => (
              <li key={c.id} className="rounded-xl border bg-card px-3 py-2 text-sm">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground" dir="auto">
                    {memberLabel(byId.get(c.userId), t("formerMember"))}
                  </span>
                  <span>{format.dateTime(new Date(c.createdAt), { dateStyle: "short", timeStyle: "short" })}</span>
                  {c.dayIndex !== null && <Badge variant="outline">{tp("dayShort", { n: c.dayIndex + 1 })}</Badge>}
                  {c.activityId && <Badge variant="outline">{name(c.activityId)}</Badge>}
                  {(c.userId === state.me || isOwner) && (
                    <Button type="button" variant="ghost" size="icon" className="ms-auto size-7" aria-label={t("deleteComment")} disabled={busy} onClick={() => run({ action: "delete_comment", commentId: c.id })}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap" dir="auto">
                  {c.text}
                </p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={submitComment} className="mt-3 space-y-2">
          <label htmlFor="collab-comment" className="sr-only">
            {t("writeComment")}
          </label>
          <textarea id="collab-comment" rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("writeComment")} className={`${inputClass} h-auto py-2`} />
          <div className="flex flex-wrap items-center gap-2">
            <select value={dayIndex ?? ""} onChange={(e) => setDayIndex(e.target.value === "" ? null : Number(e.target.value))} className="h-10 rounded-lg border bg-card px-2 text-sm" aria-label={t("aboutDay")}>
              <option value="">{t("wholeTrip")}</option>
              {(trip.plan?.itinerary.days ?? []).map((d) => (
                <option key={d.index} value={d.index}>
                  {tp("dayShort", { n: d.index + 1 })}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={busy || !text.trim()}>
              <Send aria-hidden />
              {t("send")}
            </Button>
          </div>
        </form>
      </section>
      <p className="text-xs text-muted-foreground">{t("syncNote")}</p>
    </div>
  );
}

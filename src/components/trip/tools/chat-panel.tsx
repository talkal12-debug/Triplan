"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bot, KeyRound, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/wizard/controls";
import type { GuestTrip } from "@/lib/guest/trips";
import { applyEdit } from "@/lib/guest/plan-edits";
import { editOpSchema, type EditOp } from "@/lib/planner/edit-ops";
import { placeLabel } from "@/lib/guest/plan-helpers";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

type Props = { trip: GuestTrip; onTripChange: (trip: GuestTrip) => void; readOnly?: boolean };
type Message = { role: "user" | "assistant"; content: string; ops?: EditOp[]; applied?: number };

const statusSchema = z.object({ enabled: z.boolean(), model: z.string().nullable() });
const replySchema = z.object({ reply: z.string(), ops: z.array(editOpSchema) });

/**
 * Free-text editing. The assistant answers with structured edit ops, which run
 * through the same /api/plan/edit pipeline as the buttons, one after another.
 * Without ANTHROPIC_API_KEY the panel explains that a key is needed.
 */
export function ChatPanel({ trip, onTripChange, readOnly }: Props) {
  const t = useTranslations("chat");
  const locale = useLocale() as Locale;
  const [status, setStatus] = useState<z.infer<typeof statusSchema> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const latest = useRef(trip);
  latest.current = trip;

  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((j) => setStatus(statusSchema.parse(j)))
      .catch(() => setStatus({ enabled: false, model: null }));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || !trip.plan) return;
    const history = [...messages, { role: "user" as const, content }];
    setMessages(history);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const plan = trip.plan;
      const ids = new Set([...Object.keys(plan.places), ...plan.unused]);
      const names = Object.fromEntries([...ids].map((id) => [id, placeLabel(plan.places[id], locale, id)]));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: trip.preferences,
          plan,
          messages: history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          names,
          locale,
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error((json as { message?: string; error?: string } | null)?.message ?? (json as { error?: string } | null)?.error ?? res.statusText);
      const { reply, ops } = replySchema.parse(json);
      let applied = 0;
      if (!readOnly) {
        for (const op of ops) {
          try {
            const result = await applyEdit(latest.current, op);
            latest.current = result.trip;
            onTripChange(result.trip);
            applied++;
          } catch {
            // Skip an op the editor refuses (e.g. a locked activity); the reply still shows.
          }
        }
      }
      setMessages((m) => [...m, { role: "assistant", content: reply, ops, applied }]);
    } catch (err) {
      setError(t("error", { message: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  if (!status.enabled) {
    return (
      <div className="rounded-2xl border bg-card p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4" aria-hidden />
          {t("needsKey")}
        </p>
        <p className="mt-1 text-muted-foreground">{t("needsKeyBody")}</p>
        <p className="mt-3 text-xs text-muted-foreground">{t("examples")}</p>
      </div>
    );
  }
  if (!trip.plan) return <p className="text-sm text-muted-foreground">{t("noPlan")}</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("intro", { model: status.model ?? "" })}</p>
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border bg-card p-3" aria-live="polite">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">{t("examples")}</p>}
        {messages.map((m, i) => (
          <div key={i} className={cn("max-w-[90%] rounded-xl px-3 py-2 text-sm", m.role === "user" ? "ms-auto bg-primary text-primary-foreground" : "bg-muted")} dir="auto">
            {m.role === "assistant" && <Bot className="mb-1 size-4 text-muted-foreground" aria-hidden />}
            <p className="whitespace-pre-wrap">{m.content}</p>
            {m.ops && m.ops.length > 0 && (
              <p className="mt-1 text-xs opacity-80">{readOnly ? t("opsReadOnly", { count: m.ops.length }) : t("opsApplied", { applied: m.applied ?? 0, total: m.ops.length })}</p>
            )}
          </div>
        ))}
        {busy && <p className="text-sm text-muted-foreground">{t("thinking")}</p>}
        <div ref={endRef} />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          {t("placeholder")}
        </label>
        <input id="chat-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("placeholder")} maxLength={4000} className={inputClass} disabled={busy} />
        <Button type="submit" disabled={busy || !input.trim()} aria-label={t("send")}>
          <Send aria-hidden />
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}

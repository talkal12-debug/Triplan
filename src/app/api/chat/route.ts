import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { editOpSchema } from "@/lib/planner/edit-ops";
import { compactPlan, compactPreferences } from "@/lib/chat/compact";
import { guestPlanSchema } from "@/lib/guest/schema";
import { tripPreferencesSchema } from "@/lib/planner/types";
import { isLocale, localeNames } from "@/lib/i18n/locales";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MODEL = "claude-sonnet-5";

function enabled(): boolean {
  return Boolean(getEnv().ANTHROPIC_API_KEY);
}

/** GET /api/chat -> { enabled, model } so the UI can show the "needs a key" state honestly. */
export async function GET() {
  return NextResponse.json({ enabled: enabled(), model: enabled() ? (process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL) : null });
}

const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) });
const requestSchema = z.object({
  preferences: tripPreferencesSchema,
  plan: guestPlanSchema,
  messages: z.array(messageSchema).min(1).max(20),
  locale: z.string().optional(),
  /** Display names for place ids, resolved by the client in the UI language. */
  names: z.record(z.string(), z.string()),
});

/** Edits the chat may propose. "alternatives" is a query, not an edit, and is filtered out below. */
const proposalSchema = z.object({ reply: z.string(), ops: z.array(editOpSchema).max(10) });

const toolInputSchema = z.toJSONSchema(proposalSchema, { target: "draft-7" }) as Record<string, unknown>;

/**
 * POST /api/chat { preferences, plan, messages, names, locale } -> { reply, ops }
 * The model never touches the plan: it proposes structured edit ops that the
 * client runs through the same /api/plan/edit pipeline as the buttons.
 */
export async function POST(req: Request) {
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_key" }, { status: 503 });
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  const { preferences, plan, messages, names } = parsed.data;
  const locale = parsed.data.locale && isLocale(parsed.data.locale) ? parsed.data.locale : "he";

  const compact = compactPlan(plan, (id) => names[id] ?? id);
  const system = [
    "You are Triplan's itinerary assistant. You help a traveller adjust an existing day-by-day trip plan.",
    `Reply in ${localeNames[locale]}. Be brief and concrete.`,
    "You can only change the plan through the propose_edits tool: a list of structured operations that reference the ids in the plan.",
    "Rules: never invent place ids; use ids from the plan or from unusedPlaces. 'swap' replaces an activity with an unused place (placeId). 'remove' deletes an activity. 'move' moves an activity to another day (fromDay/toDay are 0-based day indexes). 'rebalance' makes a day lighter or heavier. 'rebuild' regenerates the unlocked parts of a day. 'lock' toggles a lock. 'reorder' takes the placeIds of a day in the new order.",
    "If the request cannot be done with these operations (for example changing dates, hotels or destinations), say so and propose no ops.",
    "Locked activities must not be moved, swapped or removed.",
    `Traveller preferences: ${JSON.stringify(compactPreferences(preferences))}`,
    `Current plan: ${JSON.stringify(compact)}`,
  ].join("\n");

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
      max_tokens: 1200,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [
        {
          name: "propose_edits",
          description: "Answer the traveller and propose zero or more structured edits to the plan.",
          input_schema: toolInputSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: "propose_edits" },
    });
    const toolUse = response.content.find((c) => c.type === "tool_use");
    const proposal = proposalSchema.safeParse(toolUse && toolUse.type === "tool_use" ? toolUse.input : null);
    if (!proposal.success) {
      const text = response.content.find((c) => c.type === "text");
      return NextResponse.json({ reply: text && text.type === "text" ? text.text : "", ops: [] });
    }
    // Drop ops that point at ids not in the plan, so a hallucinated id never reaches the editor.
    const activityIds = new Set(plan.itinerary.days.flatMap((d) => d.activities.map((a) => a.id)));
    const placeIds = new Set([...Object.keys(plan.places), ...plan.unused]);
    const ops = proposal.data.ops.filter((op) => {
      if (op.type === "alternatives") return false;
      if ("activityId" in op && !activityIds.has(op.activityId)) return false;
      if (op.type === "swap" && !placeIds.has(op.placeId)) return false;
      if (op.type === "reorder" && !op.placeIds.every((id: string) => placeIds.has(id))) return false;
      const days = plan.itinerary.days.length;
      if ("dayIndex" in op && op.dayIndex >= days) return false;
      if (op.type === "move" && (op.fromDay >= days || op.toDay >= days)) return false;
      return true;
    });
    return NextResponse.json({ reply: proposal.data.reply, ops, model: response.model });
  } catch (err) {
    return NextResponse.json({ error: "provider_failed", message: (err as Error).message }, { status: 502 });
  }
}

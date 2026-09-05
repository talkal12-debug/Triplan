import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { localeNames, isLocale } from "@/lib/i18n/locales";

/**
 * Machine translation of place descriptions into the UI language, used only
 * when Wikipedia has no article in that language. Runs on Claude when
 * ANTHROPIC_API_KEY is set; without a key nothing is translated and the UI
 * shows the English text with a "translate with Google" link instead.
 * Every translation is marked (`translatedFrom`) so the reader knows.
 */
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const MAX_ITEMS = 40;

export function translationEnabled(): boolean {
  return Boolean(getEnv().ANTHROPIC_API_KEY);
}

const outputSchema = z.object({ translations: z.array(z.object({ id: z.string(), text: z.string() })) });
const toolInputSchema = z.toJSONSchema(outputSchema, { target: "draft-7" }) as Record<string, unknown>;

/** Translate `items` (id + text in `from`) into `to`. Missing or failed items are simply absent from the result. */
export async function translateTexts(items: { id: string; text: string }[], from: string, to: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const env = getEnv();
  if (!env.ANTHROPIC_API_KEY || items.length === 0 || from === to || !isLocale(to)) return out;
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_TRANSLATE_MODEL ?? DEFAULT_MODEL;
  for (let i = 0; i < items.length; i += MAX_ITEMS) {
    const batch = items.slice(i, i + MAX_ITEMS);
    try {
      const response = await client.messages.create({
        model,
        max_tokens: 4000,
        system: `You translate short encyclopedic descriptions of places for a travel app. Translate each text from ${isLocale(from) ? localeNames[from] : from} into ${localeNames[to]}. Keep proper names recognisable (transliterate when the language does not use the Latin alphabet), keep numbers and facts exactly, do not add or drop information, no commentary. Return every id.`,
        tools: [{ name: "submit_translations", description: "Return the translations.", input_schema: toolInputSchema as Anthropic.Tool["input_schema"] }],
        tool_choice: { type: "tool", name: "submit_translations" },
        messages: [{ role: "user", content: JSON.stringify(batch) }],
      });
      const block = response.content.find((b) => b.type === "tool_use");
      const parsed = block && block.type === "tool_use" ? outputSchema.safeParse(block.input) : null;
      if (!parsed?.success) continue;
      const wanted = new Set(batch.map((b) => b.id));
      for (const t of parsed.data.translations) if (wanted.has(t.id) && t.text.trim()) out.set(t.id, t.text.trim());
    } catch {
      // Translation is best effort: the English text stays visible.
    }
  }
  return out;
}

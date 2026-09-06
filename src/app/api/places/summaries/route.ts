import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSummariesBatch, type Summary } from "@/lib/providers/summaries-core";
import { translateMissing } from "@/lib/providers/summaries";
import { prisma } from "@/lib/db";
import { isLocale } from "@/lib/i18n/locales";

export const runtime = "nodejs";
export const maxDuration = 120;

const requestSchema = z.object({
  places: z.array(z.object({ id: z.string(), wikidata: z.string().regex(/^Q\d+$/) })).max(60),
  locales: z.array(z.string()).min(1).max(3),
});

/**
 * POST /api/places/summaries { places: [{id, wikidata}], locales } -> { summaries: { [id]: { [locale]: {text, url} } } }
 * Descriptions for places already in a saved plan (built before summaries existed,
 * or opened in another UI language). Cached rows in the Place table answer first.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const locales: string[] = parsed.data.locales.filter(isLocale);
  if (locales.length === 0) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const summaries: Record<string, Record<string, Summary>> = {};
  const rows = await prisma.place.findMany({ where: { id: { in: parsed.data.places.map((p) => p.id) } }, select: { id: true, summary: true } });
  for (const r of rows) {
    if (!r.summary) continue;
    const s = JSON.parse(r.summary) as Record<string, Summary>;
    const hit = Object.fromEntries(Object.entries(s).filter(([l]) => locales.includes(l)));
    if (Object.keys(hit).length) summaries[r.id] = hit;
  }
  const todo = parsed.data.places
    .map((p) => ({ id: p.id, wikidata: p.wikidata, locales: locales.filter((l) => !summaries[p.id]?.[l]) }))
    .filter((p) => p.locales.length > 0);
  const fetched = await fetchSummariesBatch(todo);
  const changed = new Set<string>();
  for (const [id, got] of fetched) {
    summaries[id] = { ...(summaries[id] ?? {}), ...got };
    changed.add(id);
  }
  // Wikipedia has no article in the UI language: translate the English lead when a key allows it.
  const byId = new Map(Object.entries(summaries));
  for (const id of await translateMissing(byId, locales[0])) changed.add(id);
  for (const id of changed) {
    void prisma.place.updateMany({ where: { id }, data: { summary: JSON.stringify(summaries[id]) } }).catch(() => undefined);
  }
  return NextResponse.json({ summaries });
}

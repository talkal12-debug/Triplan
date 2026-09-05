import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchSummariesBatch } from "@/lib/providers/summaries-core";
import { prisma } from "@/lib/db";
import { isLocale } from "@/lib/i18n/locales";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const summaries: Record<string, Record<string, { text: string; url: string | null }>> = {};
  const rows = await prisma.place.findMany({ where: { id: { in: parsed.data.places.map((p) => p.id) } }, select: { id: true, summary: true } });
  for (const r of rows) {
    if (!r.summary) continue;
    const s = JSON.parse(r.summary) as Record<string, { text: string; url: string | null }>;
    const hit = Object.fromEntries(Object.entries(s).filter(([l]) => locales.includes(l)));
    if (Object.keys(hit).length) summaries[r.id] = hit;
  }
  const todo = parsed.data.places
    .map((p) => ({ id: p.id, wikidata: p.wikidata, locales: locales.filter((l) => !summaries[p.id]?.[l]) }))
    .filter((p) => p.locales.length > 0);
  const fetched = await fetchSummariesBatch(todo);
  for (const [id, got] of fetched) {
    summaries[id] = { ...(summaries[id] ?? {}), ...got };
    void prisma.place.updateMany({ where: { id }, data: { summary: JSON.stringify(summaries[id]) } }).catch(() => undefined);
  }
  return NextResponse.json({ summaries });
}

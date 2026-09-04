import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/templates/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/templates/:id -> { template } (preferences + plan snapshot, for cloning) */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ template }, { headers: { "Cache-Control": "public, max-age=3600" } });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getRouting } from "@/lib/providers/registry";

export const runtime = "nodejs";

const requestSchema = z.object({
  points: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).min(2).max(25),
  mode: z.enum(["walk", "bike", "car"]),
});

/**
 * POST /api/route { points, mode } -> { route: { coordinates, meters, minutes } | null }
 * Street geometry for the day's map line (OSRM). null means "draw straight lines":
 * no provider, transit, or the routing server did not answer.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const route = await getRouting().route(parsed.data.points, parsed.data.mode);
  return NextResponse.json({ route }, { headers: { "Cache-Control": "public, max-age=86400" } });
}

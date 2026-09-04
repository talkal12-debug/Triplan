import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { guestTripSchema } from "@/lib/guest/schema";
import { listUserTrips, upsertUserTrip } from "@/lib/trips/server";

export const runtime = "nodejs";

/** GET /api/trips -> { trips } (the signed-in user's trips, newest first) */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ trips: await listUserTrips(user.id) });
}

const postSchema = z.object({ trips: z.array(guestTripSchema).max(200) });

/**
 * POST /api/trips { trips } -> { results: Record<id, created|updated|stale|forbidden> }
 * Bulk upload: used right after sign-in to move guest trips into the account.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  const results: Record<string, string> = {};
  for (const trip of parsed.data.trips) {
    results[trip.id] = await upsertUserTrip(user.id, trip);
  }
  return NextResponse.json({ results });
}

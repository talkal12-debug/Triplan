import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { tripPreferencesSchema, tripEndDate } from "@/lib/planner/types";
import { guestPlanSchema } from "@/lib/guest/schema";

export const runtime = "nodejs";

const requestSchema = z.object({
  preferences: tripPreferencesSchema,
  plan: guestPlanSchema,
  canEdit: z.boolean().default(false),
  title: z.string().max(120).optional(),
});

/**
 * POST /api/share { preferences, plan, canEdit } -> { token, url }
 * Stores a snapshot as a guest Trip row (no owner) with a random share token.
 */
export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  const { preferences, plan, canEdit, title } = parsed.data;
  const token = randomBytes(9).toString("base64url");
  await prisma.trip.create({
    data: {
      title: title ?? preferences.destinations.map((d) => d.countryCode).join("+"),
      status: "planned",
      preferences: JSON.stringify(preferences),
      startDate: new Date(`${preferences.dates.start}T00:00:00Z`),
      endDate: new Date(`${tripEndDate(preferences.dates)}T00:00:00Z`),
      countries: JSON.stringify(preferences.destinations.map((d) => d.countryCode)),
      baseMode: preferences.hotel.baseMode,
      shareToken: token,
      shareCanEdit: canEdit,
      plan: JSON.stringify(plan),
    },
  });
  return NextResponse.json({ token });
}

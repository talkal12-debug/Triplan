import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { tripPreferencesSchema } from "@/lib/planner/types";
import { guestPlanSchema } from "@/lib/guest/schema";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET /api/share/:token -> { preferences, plan, canEdit, updatedAt } */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const trip = await prisma.trip.findUnique({ where: { shareToken: token } });
  if (!trip || !trip.plan) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({
    preferences: JSON.parse(trip.preferences),
    plan: JSON.parse(trip.plan),
    canEdit: trip.shareCanEdit,
    title: trip.title,
    updatedAt: trip.updatedAt.toISOString(),
  });
}

const putSchema = z.object({ preferences: tripPreferencesSchema.optional(), plan: guestPlanSchema });

/**
 * PUT /api/share/:token { plan } -> saves a new version.
 * Allowed for the owner's own updates and, when the link is editable, for anyone with it.
 * (Ownership arrives with accounts in milestone 8; until then the token is the capability.)
 */
export async function PUT(req: Request, { params }: Ctx) {
  const { token } = await params;
  const trip = await prisma.trip.findUnique({ where: { shareToken: token } });
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const ownerHeader = req.headers.get("x-triplan-share-owner") === "1";
  if (!trip.shareCanEdit && !ownerHeader) return NextResponse.json({ error: "read_only" }, { status: 403 });
  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  await prisma.trip.update({
    where: { id: trip.id },
    data: { plan: JSON.stringify(parsed.data.plan), ...(parsed.data.preferences ? { preferences: JSON.stringify(parsed.data.preferences) } : {}) },
  });
  return NextResponse.json({ ok: true });
}

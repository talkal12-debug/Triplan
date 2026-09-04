import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { guestTripSchema } from "@/lib/guest/schema";
import { deleteUserTrip, rowToTrip, upsertUserTrip } from "@/lib/trips/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/trips/:id -> { trip } (owner only) */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const row = await prisma.trip.findFirst({ where: { id, ownerId: user.id } });
  const trip = row ? rowToTrip(row) : null;
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ trip });
}

/** PUT /api/trips/:id { trip } -> { result } */
export async function PUT(req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = guestTripSchema.safeParse((await req.json().catch(() => ({})))?.trip);
  if (!parsed.success || parsed.data.id !== id) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await upsertUserTrip(user.id, parsed.data);
  if (result === "forbidden") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ result });
}

/** DELETE /api/trips/:id -> { ok } */
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const ok = await deleteUserTrip(user.id, id);
  return NextResponse.json({ ok });
}

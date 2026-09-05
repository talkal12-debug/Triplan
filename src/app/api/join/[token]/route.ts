import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { joinByInvite } from "@/lib/collab/server";
import { collabState } from "@/lib/collab/server";
import { prisma } from "@/lib/db";
import { rowToTrip } from "@/lib/trips/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** GET /api/join/:token -> { title, ownerName, role } preview of the invite (no membership yet) */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  const trip = await prisma.trip.findUnique({ where: { inviteToken: token }, include: { owner: { select: { name: true, email: true } } } });
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ title: trip.title, ownerName: trip.owner?.name ?? trip.owner?.email ?? null, role: trip.inviteRole, countries: JSON.parse(trip.countries) });
}

/** POST /api/join/:token -> { trip, role } and the caller becomes a member */
export async function POST(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { token } = await params;
  const joined = await joinByInvite(user.id, token);
  if (!joined) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [row, state] = await Promise.all([prisma.trip.findUnique({ where: { id: joined.tripId }, include: { owner: { select: { name: true, email: true } } } }), collabState(user.id, joined.tripId)]);
  const trip = row ? rowToTrip(row, { role: joined.role, ownerName: row.owner?.name ?? row.owner?.email ?? null }) : null;
  if (!trip) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ trip, role: joined.role, members: state?.members ?? [] });
}

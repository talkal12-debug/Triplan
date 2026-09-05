import "server-only";
import type { Trip } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guestTripSchema, type GuestTrip } from "@/lib/guest/schema";
import { tripEndDate } from "@/lib/planner/types";

export type Role = "owner" | "editor" | "viewer";

/**
 * Account trips are stored as the same document the browser keeps in
 * localStorage (GuestTrip), spread over the Trip row's JSON columns. This keeps
 * one shape end to end: guest -> account migration is a plain upload.
 */
export function rowToTrip(row: Trip, membership?: { role: Role; ownerName: string | null }): GuestTrip | null {
  const candidate = {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    preferences: JSON.parse(row.preferences),
    plan: row.plan ? JSON.parse(row.plan) : undefined,
    packing: row.packingList ? JSON.parse(row.packingList) : undefined,
    checklist: row.checklist ? JSON.parse(row.checklist) : undefined,
    journal: row.journal ? JSON.parse(row.journal) : undefined,
    share: row.shareToken ? { token: row.shareToken, canEdit: row.shareCanEdit, createdAt: row.createdAt.toISOString() } : undefined,
    membership: membership && membership.role !== "owner" ? membership : undefined,
  };
  const parsed = guestTripSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function tripToRow(trip: GuestTrip) {
  const p = trip.preferences;
  return {
    title: p.destinations.map((d) => d.countryCode).join("+"),
    status: trip.plan ? "planned" : "draft",
    preferences: JSON.stringify(p),
    startDate: new Date(`${p.dates.start}T00:00:00Z`),
    endDate: new Date(`${tripEndDate(p.dates)}T00:00:00Z`),
    countries: JSON.stringify(p.destinations.map((d) => d.countryCode)),
    baseMode: p.hotel.baseMode,
    plan: trip.plan ? JSON.stringify(trip.plan) : null,
    packingList: trip.packing ? JSON.stringify(trip.packing) : null,
    checklist: trip.checklist ? JSON.stringify(trip.checklist) : null,
    updatedAt: new Date(trip.updatedAt),
  };
}

/** The user's role on a trip, or null when they have no access. */
export async function roleOn(userId: string, tripId: string): Promise<{ role: Role; trip: Trip } | null> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return null;
  if (trip.ownerId === userId) return { role: "owner", trip };
  const member = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
  if (!member) return null;
  return { role: member.role === "editor" ? "editor" : "viewer", trip };
}

/** Own trips plus trips shared with the user (with membership info), newest first. */
export async function listUserTrips(userId: string): Promise<GuestTrip[]> {
  const [own, memberships] = await Promise.all([
    prisma.trip.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" } }),
    prisma.tripMember.findMany({ where: { userId }, include: { trip: { include: { owner: { select: { name: true, email: true } } } } } }),
  ]);
  const mine = own.map((r) => rowToTrip(r));
  const shared = memberships.map((m) =>
    rowToTrip(m.trip, { role: m.role === "editor" ? "editor" : "viewer", ownerName: m.trip.owner?.name ?? m.trip.owner?.email ?? null }),
  );
  return [...mine, ...shared].filter((t): t is GuestTrip => t !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Create or update a trip the user owns or edits. Refuses to overwrite a newer
 * server copy ("stale"), viewers and strangers ("forbidden"). The journal is
 * personal: only the owner's copy is stored.
 */
export async function upsertUserTrip(userId: string, trip: GuestTrip): Promise<"created" | "updated" | "stale" | "forbidden"> {
  const existing = await prisma.trip.findUnique({ where: { id: trip.id } });
  if (existing) {
    const isOwner = existing.ownerId === userId;
    if (!isOwner) {
      if (!existing.ownerId) {
        // A guest snapshot (share link) being claimed by an account: fine.
      } else {
        const member = await prisma.tripMember.findUnique({ where: { tripId_userId: { tripId: trip.id, userId } } });
        if (member?.role !== "editor") return "forbidden";
      }
    }
    if (existing.ownerId && existing.updatedAt.getTime() > new Date(trip.updatedAt).getTime()) return "stale";
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        ...tripToRow(trip),
        ...(isOwner || !existing.ownerId ? { ownerId: userId, journal: trip.journal ? JSON.stringify(trip.journal) : null } : {}),
      },
    });
    return "updated";
  }
  await prisma.trip.create({
    data: { id: trip.id, ownerId: userId, createdAt: new Date(trip.createdAt), ...tripToRow(trip), journal: trip.journal ? JSON.stringify(trip.journal) : null },
  });
  return "created";
}

export async function deleteUserTrip(userId: string, id: string): Promise<boolean> {
  const res = await prisma.trip.deleteMany({ where: { id, ownerId: userId } });
  if (res.count > 0) return true;
  // A member "deleting" a shared trip only leaves it.
  const left = await prisma.tripMember.deleteMany({ where: { tripId: id, userId } });
  return left.count > 0;
}

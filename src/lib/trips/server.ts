import "server-only";
import type { Trip } from "@prisma/client";
import { prisma } from "@/lib/db";
import { guestTripSchema, type GuestTrip } from "@/lib/guest/schema";
import { tripEndDate } from "@/lib/planner/types";

/**
 * Account trips are stored as the same document the browser keeps in
 * localStorage (GuestTrip), spread over the Trip row's JSON columns. This keeps
 * one shape end to end: guest -> account migration is a plain upload.
 */
export function rowToTrip(row: Trip): GuestTrip | null {
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
    journal: trip.journal ? JSON.stringify(trip.journal) : null,
    updatedAt: new Date(trip.updatedAt),
  };
}

export async function listUserTrips(userId: string): Promise<GuestTrip[]> {
  const rows = await prisma.trip.findMany({ where: { ownerId: userId }, orderBy: { updatedAt: "desc" } });
  return rows.map(rowToTrip).filter((t): t is GuestTrip => t !== null);
}

/**
 * Create or update one of the user's trips. Refuses to overwrite a newer server
 * copy (returns "stale") and never touches a trip owned by someone else ("forbidden").
 */
export async function upsertUserTrip(userId: string, trip: GuestTrip): Promise<"created" | "updated" | "stale" | "forbidden"> {
  const existing = await prisma.trip.findUnique({ where: { id: trip.id } });
  if (existing) {
    if (existing.ownerId && existing.ownerId !== userId) return "forbidden";
    if (existing.ownerId && existing.updatedAt.getTime() > new Date(trip.updatedAt).getTime()) return "stale";
    await prisma.trip.update({ where: { id: trip.id }, data: { ...tripToRow(trip), ownerId: userId } });
    return "updated";
  }
  await prisma.trip.create({ data: { id: trip.id, ownerId: userId, createdAt: new Date(trip.createdAt), ...tripToRow(trip) } });
  return "created";
}

export async function deleteUserTrip(userId: string, id: string): Promise<boolean> {
  const res = await prisma.trip.deleteMany({ where: { id, ownerId: userId } });
  return res.count > 0;
}

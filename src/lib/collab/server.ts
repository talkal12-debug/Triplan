import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { roleOn, type Role } from "@/lib/trips/server";
import type { CollabState } from "./schema";

/** Owner only: create (or rotate) the invite link and set the role it grants. */
export async function setInvite(userId: string, tripId: string, role: "editor" | "viewer", rotate: boolean): Promise<{ token: string; role: "editor" | "viewer" } | null> {
  const access = await roleOn(userId, tripId);
  if (access?.role !== "owner") return null;
  const token = rotate || !access.trip.inviteToken ? randomBytes(9).toString("base64url") : access.trip.inviteToken;
  await prisma.trip.update({ where: { id: tripId }, data: { inviteToken: token, inviteRole: role } });
  return { token, role };
}

export async function revokeInvite(userId: string, tripId: string): Promise<boolean> {
  const access = await roleOn(userId, tripId);
  if (access?.role !== "owner") return false;
  await prisma.trip.update({ where: { id: tripId }, data: { inviteToken: null } });
  return true;
}

/** A signed-in user opens an invite link: becomes a member with the link's role (owner stays owner). */
export async function joinByInvite(userId: string, token: string): Promise<{ tripId: string; role: Role } | null> {
  const trip = await prisma.trip.findUnique({ where: { inviteToken: token } });
  if (!trip) return null;
  if (trip.ownerId === userId) return { tripId: trip.id, role: "owner" };
  const role = trip.inviteRole === "viewer" ? "viewer" : "editor";
  await prisma.tripMember.upsert({
    where: { tripId_userId: { tripId: trip.id, userId } },
    create: { tripId: trip.id, userId, role },
    update: { role },
  });
  return { tripId: trip.id, role };
}

export async function removeMember(userId: string, tripId: string, memberId: string): Promise<boolean> {
  const access = await roleOn(userId, tripId);
  if (!access) return false;
  // Owners remove anyone; members can only leave.
  if (access.role !== "owner" && memberId !== userId) return false;
  const res = await prisma.tripMember.deleteMany({ where: { tripId, userId: memberId } });
  return res.count > 0;
}

export async function collabState(userId: string, tripId: string): Promise<CollabState | null> {
  const access = await roleOn(userId, tripId);
  if (!access) return null;
  const [owner, members, votes, comments] = await Promise.all([
    access.trip.ownerId ? prisma.user.findUnique({ where: { id: access.trip.ownerId }, select: { id: true, name: true, email: true, image: true } }) : null,
    prisma.tripMember.findMany({ where: { tripId }, include: { user: { select: { id: true, name: true, email: true, image: true } } } }),
    prisma.vote.findMany({ where: { tripId } }),
    prisma.comment.findMany({ where: { tripId }, orderBy: { createdAt: "asc" }, take: 500 }),
  ]);
  return {
    tripId,
    me: userId,
    role: access.role,
    invite: access.role === "owner" && access.trip.inviteToken ? { token: access.trip.inviteToken, role: access.trip.inviteRole === "viewer" ? "viewer" : "editor" } : null,
    members: [
      ...(owner ? [{ userId: owner.id, name: owner.name, email: owner.email, image: owner.image, role: "owner" as const }] : []),
      ...members.map((m) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, image: m.user.image, role: (m.role === "viewer" ? "viewer" : "editor") as Role })),
    ],
    votes: votes.map((v) => ({ activityId: v.activityId, userId: v.userId, value: v.value })),
    comments: comments.map((c) => ({ id: c.id, userId: c.userId, dayIndex: c.dayIndex, activityId: c.activityId, text: c.text, createdAt: c.createdAt.toISOString() })),
  };
}

export async function castVote(userId: string, tripId: string, activityId: string, value: 1 | -1 | 0): Promise<boolean> {
  const access = await roleOn(userId, tripId);
  if (!access) return false;
  if (value === 0) {
    await prisma.vote.deleteMany({ where: { tripId, userId, activityId } });
    return true;
  }
  await prisma.vote.upsert({
    where: { tripId_userId_activityId: { tripId, userId, activityId } },
    create: { tripId, userId, activityId, value },
    update: { value },
  });
  return true;
}

export async function addComment(userId: string, tripId: string, input: { text: string; dayIndex: number | null; activityId: string | null }): Promise<boolean> {
  const access = await roleOn(userId, tripId);
  if (!access) return false;
  await prisma.comment.create({ data: { tripId, userId, text: input.text, dayIndex: input.dayIndex, activityId: input.activityId } });
  return true;
}

export async function deleteComment(userId: string, tripId: string, commentId: string): Promise<boolean> {
  const access = await roleOn(userId, tripId);
  if (!access) return false;
  const where = access.role === "owner" ? { id: commentId, tripId } : { id: commentId, tripId, userId };
  const res = await prisma.comment.deleteMany({ where });
  return res.count > 0;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { commentInputSchema, voteInputSchema } from "@/lib/collab/schema";
import { addComment, castVote, collabState, deleteComment, removeMember, revokeInvite, setInvite } from "@/lib/collab/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/trips/:id/collab -> CollabState (members, invite, votes, comments) */
export async function GET(_req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const state = await collabState(user.id, id);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state);
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("vote"), ...voteInputSchema.shape }),
  z.object({ action: z.literal("comment"), ...commentInputSchema.shape }),
  z.object({ action: z.literal("invite"), role: z.enum(["editor", "viewer"]), rotate: z.boolean().default(false) }),
  z.object({ action: z.literal("revoke_invite") }),
  z.object({ action: z.literal("remove_member"), userId: z.string() }),
  z.object({ action: z.literal("delete_comment"), commentId: z.string() }),
]);

/** POST /api/trips/:id/collab { action, ... } -> CollabState after the change */
export async function POST(req: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  const a = parsed.data;
  let ok = false;
  switch (a.action) {
    case "vote":
      ok = await castVote(user.id, id, a.activityId, a.value);
      break;
    case "comment":
      ok = await addComment(user.id, id, { text: a.text, dayIndex: a.dayIndex, activityId: a.activityId });
      break;
    case "invite":
      ok = (await setInvite(user.id, id, a.role, a.rotate)) !== null;
      break;
    case "revoke_invite":
      ok = await revokeInvite(user.id, id);
      break;
    case "remove_member":
      ok = await removeMember(user.id, id, a.userId);
      break;
    case "delete_comment":
      ok = await deleteComment(user.id, id, a.commentId);
      break;
  }
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const state = await collabState(user.id, id);
  if (!state) return NextResponse.json({ ok: true });
  return NextResponse.json(state);
}

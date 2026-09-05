import { z } from "zod";

/** Collaboration state of one trip, as served by GET /api/trips/:id/collab. Plain Zod: client and server. */
export const memberSchema = z.object({
  userId: z.string(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  image: z.string().nullable(),
  role: z.enum(["owner", "editor", "viewer"]),
});
export type Member = z.infer<typeof memberSchema>;

export const voteSchema = z.object({ activityId: z.string(), userId: z.string(), value: z.number().int() });
export type Vote = z.infer<typeof voteSchema>;

export const commentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  dayIndex: z.number().int().nullable(),
  activityId: z.string().nullable(),
  text: z.string(),
  createdAt: z.string(),
});
export type Comment = z.infer<typeof commentSchema>;

export const collabStateSchema = z.object({
  tripId: z.string(),
  me: z.string(),
  role: z.enum(["owner", "editor", "viewer"]),
  invite: z.object({ token: z.string(), role: z.enum(["editor", "viewer"]) }).nullable(),
  members: z.array(memberSchema),
  votes: z.array(voteSchema),
  comments: z.array(commentSchema),
});
export type CollabState = z.infer<typeof collabStateSchema>;

export const commentInputSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  dayIndex: z.number().int().min(0).nullable().default(null),
  activityId: z.string().nullable().default(null),
});
export const voteInputSchema = z.object({ activityId: z.string(), value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });

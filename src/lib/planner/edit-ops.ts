import { z } from "zod";

/**
 * Structured edit operations. Shared by the UI (milestone 5), the edit API and,
 * later, the AI chat (milestone 8), which emits exactly these objects.
 */
export const editOpSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("alternatives"), dayIndex: z.number().int().min(0), activityId: z.string() }),
  z.object({ type: z.literal("swap"), dayIndex: z.number().int().min(0), activityId: z.string(), placeId: z.string() }),
  z.object({
    type: z.literal("move"),
    fromDay: z.number().int().min(0),
    activityId: z.string(),
    toDay: z.number().int().min(0),
    position: z.number().int().min(0).optional(),
  }),
  z.object({ type: z.literal("reorder"), dayIndex: z.number().int().min(0), placeIds: z.array(z.string()) }),
  z.object({ type: z.literal("remove"), dayIndex: z.number().int().min(0), activityId: z.string() }),
  z.object({ type: z.literal("rebalance"), dayIndex: z.number().int().min(0), direction: z.enum(["lighter", "heavier"]) }),
  z.object({ type: z.literal("lock"), dayIndex: z.number().int().min(0), activityId: z.string() }),
  z.object({ type: z.literal("rebuild"), dayIndex: z.number().int().min(0) }),
]);
export type EditOp = z.infer<typeof editOpSchema>;

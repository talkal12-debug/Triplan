"use client";

import { useTranslations } from "next-intl";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { tally, useCollabStore } from "@/lib/collab/store";
import { cn } from "@/lib/utils";

type Props = { activityId: string };

/**
 * Thumbs up / down for one activity. Rendered only when the trip has
 * collaborators (collab state loaded and more than one member).
 */
export function VoteBar({ activityId }: Props) {
  const t = useTranslations("collab");
  const state = useCollabStore((s) => s.state);
  const act = useCollabStore((s) => s.act);
  if (!state || state.members.length < 2) return null;
  const { up, down, mine } = tally(state, activityId);

  function vote(value: 1 | -1, e: React.MouseEvent) {
    e.stopPropagation();
    if (!state) return;
    void act(state.tripId, { action: "vote", activityId, value: mine === value ? 0 : value });
  }

  return (
    <div className="mt-1.5 flex items-center gap-1" role="group" aria-label={t("votes")}>
      <button
        type="button"
        aria-pressed={mine === 1}
        aria-label={t("voteUp")}
        onClick={(e) => vote(1, e)}
        className={cn("flex h-7 items-center gap-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50", mine === 1 ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}
      >
        <ThumbsUp className="size-3.5" aria-hidden />
        {up}
      </button>
      <button
        type="button"
        aria-pressed={mine === -1}
        aria-label={t("voteDown")}
        onClick={(e) => vote(-1, e)}
        className={cn("flex h-7 items-center gap-1 rounded-full border px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50", mine === -1 ? "border-destructive bg-destructive/10 text-destructive" : "text-muted-foreground hover:bg-muted")}
      >
        <ThumbsDown className="size-3.5" aria-hidden />
        {down}
      </button>
    </div>
  );
}

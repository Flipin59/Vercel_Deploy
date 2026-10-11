"use client";

import { useState } from "react";
import { useT } from "@/shared/i18n";
import { Card, TitleBadge } from "@/shared/ui/primitives";
import { toggleVoteAction } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import type { ForumThread } from "./types";

const PILLAR_ICONS: Record<string, string> = {
  budget: "📊",
  save: "💰",
  invest: "📈",
  safety: "🛡️",
};

export function ThreadCard({
  thread,
  onSelect,
}: {
  thread: ForumThread;
  onSelect: () => void;
}) {
  const t = useT({ en, te, hi });

  const [upvotes, setUpvotes] = useState(thread.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(thread.hasUpvoted ?? false);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVoting) return;
    setIsVoting(true);

    // Optimistic update, then the server's real count (or a rollback on failure).
    const before = { upvotes, hasUpvoted };
    setHasUpvoted(!hasUpvoted);
    setUpvotes(hasUpvoted ? Math.max(0, upvotes - 1) : upvotes + 1);

    const res = await toggleVoteAction({ threadId: thread.id }).catch(() => null);
    const after = res?.success && res.data ? res.data : before;
    setUpvotes(after.upvotes);
    setHasUpvoted(after.hasUpvoted);
    setIsVoting(false);
  };

  const formattedDate = new Date(thread.createdAt).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="cursor-pointer transition-all hover:border-brand/40">
      <div onClick={onSelect} className="flex gap-3">
        {/* Left: Upvote button widget */}
        <div className="flex flex-col items-center">
          <button
            aria-label={t("forum.upvotes")}
            onClick={handleVote}
            className={`flex flex-col items-center justify-center rounded-xl border px-2.5 py-1.5 transition-colors ${
              hasUpvoted
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-surface-raised text-muted hover:border-brand/50 hover:text-foreground"
            }`}
          >
            <span className="text-sm">▲</span>
            <span className="text-xs font-bold">{upvotes}</span>
          </button>
        </div>

        {/* Right: Content preview */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              {PILLAR_ICONS[thread.pillar] ?? "📌"} {thread.pillar.toUpperCase()}
            </span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-muted">{formattedDate}</span>
          </div>

          <h3 className="text-sm font-bold leading-snug text-foreground hover:text-brand">
            {thread.title}
          </h3>

          <p className="line-clamp-2 text-xs text-muted">{thread.content}</p>

          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {thread.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-muted"
              >
                #{tag}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-muted">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{thread.authorUsername}</span>
              <TitleBadge label={thread.authorTitle} />
            </div>

            <span className="flex items-center gap-1 text-xs">
              💬 {thread.replyCount} {t("forum.comments")}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

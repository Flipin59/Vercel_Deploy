"use client";

import { useMemo, useState } from "react";
import { useLanguage, useT } from "@/shared/i18n";
import { Button, Card, TitleBadge, Toast } from "@/shared/ui/primitives";
import { acceptReplyAction, createReplyAction, getThreadDetailAction, toggleVoteAction, translateThreadAction } from "./actions";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";
import { ReportModal } from "./ReportModal";
import { checkSafety } from "./safety";
import type { ForumReply, ForumThread, ThreadTranslation } from "./types";

export function ThreadDetailView({
  thread: initialThread,
  replies: initialReplies,
  onBack,
}: {
  thread: ForumThread;
  replies: ForumReply[];
  onBack: () => void;
}) {
  const t = useT({ en, te, hi });

  const [thread, setThread] = useState(initialThread);
  const [replies, setReplies] = useState(initialReplies);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccepting, setIsAccepting] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Machine translation for Telugu and Hindi readers: fetched on request, then toggled with the original.
  const { language } = useLanguage();
  const [translation, setTranslation] = useState<ThreadTranslation | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const translated = showTranslated ? translation : null;

  const toggleTranslation = async () => {
    if (showTranslated) return setShowTranslated(false);
    setIsTranslating(true);
    // Fetched again each time, so replies added since are included (the server caches).
    const next = await translateThreadAction(thread.id).catch(() => null);
    setIsTranslating(false);
    if (!next) return showToast(t("forum.translateFailed"));
    setTranslation(next);
    setShowTranslated(true);
  };

  // Reporting state
  const [reportingTarget, setReportingTarget] = useState<{
    threadId?: string;
    replyId?: string;
  } | null>(null);

  // Safety validation for new comment
  const safetyWarning = useMemo(() => {
    const check = checkSafety(newComment);
    if (!check.safe) {
      return check.violation === "email" ? t("forum.errorEmail") : t("forum.errorPhone");
    }
    return null;
  }, [newComment, t]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Optimistic toggle, then the server's real count, or back to `before` on failure.
  const vote = async (
    target: { threadId?: string; replyId?: string },
    before: { upvotes: number; hasUpvoted?: boolean },
    apply: (state: { upvotes: number; hasUpvoted: boolean }) => void,
  ) => {
    const was = Boolean(before.hasUpvoted);
    apply({ upvotes: was ? Math.max(0, before.upvotes - 1) : before.upvotes + 1, hasUpvoted: !was });
    const res = await toggleVoteAction(target).catch(() => null);
    apply(res?.success && res.data ? res.data : { upvotes: before.upvotes, hasUpvoted: was });
  };

  const handleThreadVote = () =>
    vote({ threadId: thread.id }, thread, (state) => setThread((prev) => ({ ...prev, ...state })));

  const handleReplyVote = (reply: ForumReply) =>
    vote({ replyId: reply.id }, reply, (state) =>
      setReplies((prev) => prev.map((r) => (r.id === reply.id ? { ...r, ...state } : r))),
    );

  const handleAcceptReply = async (reply: ForumReply) => {
    if (isAccepting) return;
    setIsAccepting(reply.id);
    // Optimistically mark this reply as accepted and reset any other on this thread
    setReplies((prev) =>
      prev.map((r) => ({
        ...r,
        isAccepted: r.id === reply.id,
      })),
    );

    const res = await acceptReplyAction(reply.id);
    setIsAccepting(null);
    if (res.success) {
      showToast(t(res.data ? "forum.acceptedSuccess" : "forum.acceptedMoved"));
    } else {
      // Revert if error
      setReplies((prev) =>
        prev.map((r) => ({
          ...r,
          isAccepted: r.id === reply.id ? false : r.isAccepted,
        })),
      );
      showToast(res.error);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (safetyWarning) return;
    if (newComment.trim().length < 2) return;

    setIsSubmitting(true);
    try {
      const res = await createReplyAction({
        threadId: thread.id,
        content: newComment,
      });

      if (res.success) {
        // Reload so the new reply shows the student's real username and title.
        const detail = await getThreadDetailAction(thread.id);
        if (detail) {
          setThread(detail.thread);
          setReplies(detail.replies);
        }
        setNewComment("");
      } else {
        showToast(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedDate = new Date(thread.createdAt).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-muted transition-colors hover:text-foreground"
        >
          {t("forum.backToThreads")}
        </button>
      </div>

      {/* Main Original Post Card */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              {thread.pillar.toUpperCase()}
            </span>
            <span className="text-xs text-muted">{formattedDate}</span>
          </div>

          <button
            onClick={() => setReportingTarget({ threadId: thread.id })}
            className="text-xs text-muted transition-colors hover:text-danger"
          >
            🚩 {t("forum.report")}
          </button>
        </div>

        <h1 className="text-base font-bold text-foreground">{translated?.title ?? thread.title}</h1>

        <p className="whitespace-pre-wrap text-sm text-foreground/90">{translated?.content ?? thread.content}</p>

        {language !== "en" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={toggleTranslation} disabled={isTranslating} className="min-h-11 font-semibold text-brand disabled:opacity-60">
              🌐 {t(isTranslating ? "forum.translating" : showTranslated ? "forum.showOriginal" : "forum.translate")}
            </button>
            {showTranslated && <span className="text-muted">{t("forum.translatedNote")}</span>}
          </div>
        )}

        {thread.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {thread.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{thread.authorUsername}</span>
            <TitleBadge label={thread.authorTitle} />
          </div>

          <button
            onClick={handleThreadVote}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold transition-colors ${
              thread.hasUpvoted
                ? "border-brand bg-brand/10 text-brand"
                : "border-border bg-surface-raised text-muted hover:border-brand/40 hover:text-foreground"
            }`}
          >
            <span>▲</span>
            <span>{thread.upvotes}</span>
          </button>
        </div>
      </Card>

      {/* Comment section heading */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted">
          💬 {replies.length} {t("forum.comments")}
        </h2>
      </div>

      {/* Chronological comment list */}
      <div className="flex flex-col gap-2.5">
        {replies.length === 0 ? (
          <Card className="py-6 text-center text-xs text-muted">
            {t("forum.noReplies")}
          </Card>
        ) : (
          replies.map((reply) => (
            <Card key={reply.id} className="flex flex-col gap-2 bg-surface-raised/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {reply.authorUsername}
                  </span>
                  <TitleBadge label={reply.authorTitle} />
                  {reply.authorRole && (
                    <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                      {reply.authorRole === "teacher" ? "🏫" : "🎓"} {t(`forum.role.${reply.authorRole}`)}
                    </span>
                  )}
                  {reply.isAccepted && (
                    <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
                      ✓ {t("forum.acceptedAnswer")}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setReportingTarget({ replyId: reply.id })}
                  className="text-[11px] text-muted transition-colors hover:text-danger"
                >
                  🚩
                </button>
              </div>

              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                {translated?.replies[reply.id] ?? reply.content}
              </p>

              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <span className="text-[10px] text-muted">
                  {new Date(reply.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>

                <div className="flex items-center gap-2">
                  {thread.isAuthor && !reply.isAuthor && !reply.isAccepted && (
                    <button
                      type="button"
                      onClick={() => handleAcceptReply(reply)}
                      disabled={isAccepting === reply.id}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <span>✓</span>
                      <span>{isAccepting === reply.id ? "..." : t("forum.acceptAnswer")}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleReplyVote(reply)}
                    className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      reply.hasUpvoted
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border bg-surface text-muted hover:border-brand/40 hover:text-foreground"
                    }`}
                  >
                    <span>▲</span>
                    <span>{reply.upvotes}</span>
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add comment form at bottom */}
      <Card className="sticky bottom-20 z-10 border-border bg-surface shadow-xl">
        <form onSubmit={handlePostReply} className="flex flex-col gap-2">
          {safetyWarning && (
            <div className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs font-semibold text-danger">
              ⚠️ {safetyWarning}
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              rows={2}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={t("forum.addComment")}
              className="w-full resize-none rounded-xl border border-border bg-surface-raised px-3 py-2 text-xs text-foreground outline-none focus:border-brand"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || Boolean(safetyWarning) || newComment.trim().length < 2}
              className="self-end px-3 py-2 text-xs"
            >
              {isSubmitting ? "..." : t("forum.submitComment")}
            </Button>
          </div>
        </form>
      </Card>

      {/* Report Modal */}
      {reportingTarget && (
        <ReportModal
          target={reportingTarget}
          onClose={() => setReportingTarget(null)}
          onReported={() => showToast(t("forum.reportSuccess"))}
        />
      )}

      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}

// Pure forum business rules and validation logic (tested in xp.test.ts).
// No server-only imports here so Node test runner can execute cleanly.

export type ValidationResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type AcceptValidationParams = {
  currentUserId: string;
  threadAuthorId: string;
  replyAuthorId: string;
  isReplyHidden?: boolean;
  isThreadHidden?: boolean;
  hasAcceptedAnswerAlready?: boolean;
};

export type AcceptAwardSummary = {
  awardXp: boolean;
  helperXp: number;
};

export function validateAnswerAcceptance(
  params: AcceptValidationParams,
): ValidationResult<AcceptAwardSummary> {
  if (params.isReplyHidden || params.isThreadHidden) {
    return { ok: false, error: "Cannot accept a hidden reply" };
  }

  if (params.currentUserId !== params.threadAuthorId) {
    return { ok: false, error: "Only thread author can accept an answer" };
  }

  if (params.replyAuthorId === params.currentUserId) {
    return { ok: false, error: "Cannot accept your own reply" };
  }

  // W3-F1: award once per thread; moving accept between replies does not award again.
  // Thread author curator extra 2 XP is removed (not in spec).
  const awardXp = !params.hasAcceptedAnswerAlready;
  return {
    ok: true,
    data: {
      awardXp,
      helperXp: awardXp ? 10 : 0,
    },
  };
}

export type ReplyTargetParams = {
  thread: { id: string; isHidden?: boolean } | null | undefined;
  parentReply?: { id: string; threadId: string; isHidden?: boolean } | null;
  targetThreadId: string;
};

export function validateReplyTarget(
  params: ReplyTargetParams,
): ValidationResult<void> {
  if (!params.thread || params.thread.isHidden) {
    return { ok: false, error: "Thread not found or unavailable" };
  }

  if (params.parentReply) {
    if (params.parentReply.isHidden || params.parentReply.threadId !== params.targetThreadId) {
      return { ok: false, error: "Parent reply not found in this thread" };
    }
  }

  return { ok: true, data: undefined };
}

export function isDailyPostEligible(currentCount: number, cap = 5): boolean {
  return currentCount < cap;
}

export function filterGlobalLeaderboardRows<T extends { totalXp: number; isOnboarded: boolean; isCurrentUser?: boolean }>(
  rows: T[],
): T[] {
  return rows.filter((r) => r.isOnboarded && (r.totalXp > 0 || r.isCurrentUser));
}

import assert from "node:assert/strict";
import test from "node:test";
import { istDate } from "../../shared/progress/date.ts";
import {
  filterGlobalLeaderboardRows,
  isDailyPostEligible,
  validateAnswerAcceptance,
  validateReplyTarget,
} from "./forumRules.ts";
import { checkSafety } from "./safety.ts";

test("istDate returns valid YYYY-MM-DD for IST (+05:30)", () => {
  const d = new Date("2026-10-10T20:00:00Z"); // 01:30 AM IST on Oct 11
  assert.equal(istDate(d), "2026-10-11");

  const d2 = new Date("2026-10-10T18:00:00Z"); // 23:30 PM IST on Oct 10
  assert.equal(istDate(d2), "2026-10-10");
});

test("post_created daily cap enforces 5 posts max per IST day (W3-F2)", () => {
  for (let i = 0; i < 5; i++) {
    assert.equal(isDailyPostEligible(i), true);
  }
  assert.equal(isDailyPostEligible(5), false);
  assert.equal(isDailyPostEligible(6), false);
});

test("answer_accepted rules enforce author restrictions and single award per thread (W3-F1)", () => {
  const threadAuthorId = "author-1";
  const helperStudentId = "helper-2";

  // 1. Thread author accepts helper's answer for the first time -> 10 XP helper, awardXp: true, no curator award
  const firstAccept = validateAnswerAcceptance({
    currentUserId: threadAuthorId,
    threadAuthorId,
    replyAuthorId: helperStudentId,
    hasAcceptedAnswerAlready: false,
  });
  assert.equal(firstAccept.ok, true);
  if (firstAccept.ok) {
    assert.equal(firstAccept.data.awardXp, true);
    assert.equal(firstAccept.data.helperXp, 10);
  }

  // 2. Thread author moves accepted answer to another helper -> status updates, but awardXp: false (farming prevented)
  const movedAccept = validateAnswerAcceptance({
    currentUserId: threadAuthorId,
    threadAuthorId,
    replyAuthorId: "helper-3",
    hasAcceptedAnswerAlready: true,
  });
  assert.equal(movedAccept.ok, true);
  if (movedAccept.ok) {
    assert.equal(movedAccept.data.awardXp, false);
    assert.equal(movedAccept.data.helperXp, 0);
  }

  // 3. Thread author cannot accept their own reply
  const selfAccept = validateAnswerAcceptance({
    currentUserId: threadAuthorId,
    threadAuthorId,
    replyAuthorId: threadAuthorId,
  });
  assert.equal(selfAccept.ok, false);
  if (!selfAccept.ok) {
    assert.equal(selfAccept.error, "Cannot accept your own reply");
  }

  // 4. Stranger cannot accept an answer on another person's thread
  const strangerAccept = validateAnswerAcceptance({
    currentUserId: "stranger-3",
    threadAuthorId,
    replyAuthorId: helperStudentId,
  });
  assert.equal(strangerAccept.ok, false);
  if (!strangerAccept.ok) {
    assert.equal(strangerAccept.error, "Only thread author can accept an answer");
  }

  // 5. Hidden replies cannot be accepted
  const hiddenAccept = validateAnswerAcceptance({
    currentUserId: threadAuthorId,
    threadAuthorId,
    replyAuthorId: helperStudentId,
    isReplyHidden: true,
  });
  assert.equal(hiddenAccept.ok, false);
  if (!hiddenAccept.ok) {
    assert.equal(hiddenAccept.error, "Cannot accept a hidden reply");
  }

  // 6. Hidden thread replies cannot be accepted
  const hiddenThreadAccept = validateAnswerAcceptance({
    currentUserId: threadAuthorId,
    threadAuthorId,
    replyAuthorId: helperStudentId,
    isThreadHidden: true,
  });
  assert.equal(hiddenThreadAccept.ok, false);
});

test("createReply validation rejects hidden threads and mismatched parent replies (W3-F4)", () => {
  const liveThread = { id: "th-1", isHidden: false };
  const hiddenThread = { id: "th-2", isHidden: true };

  // 1. Normal reply to live thread -> ok
  const okReply = validateReplyTarget({
    thread: liveThread,
    targetThreadId: "th-1",
  });
  assert.equal(okReply.ok, true);

  // 2. Reply to hidden thread -> rejected
  const hiddenThreadReply = validateReplyTarget({
    thread: hiddenThread,
    targetThreadId: "th-2",
  });
  assert.equal(hiddenThreadReply.ok, false);
  if (!hiddenThreadReply.ok) {
    assert.equal(hiddenThreadReply.error, "Thread not found or unavailable");
  }

  // 3. Nested reply to valid parent in same thread -> ok
  const parentInSame = { id: "r-1", threadId: "th-1", isHidden: false };
  const okNested = validateReplyTarget({
    thread: liveThread,
    parentReply: parentInSame,
    targetThreadId: "th-1",
  });
  assert.equal(okNested.ok, true);

  // 4. Nested reply to parent belonging to another thread -> rejected
  const parentInOther = { id: "r-2", threadId: "th-other", isHidden: false };
  const wrongParent = validateReplyTarget({
    thread: liveThread,
    parentReply: parentInOther,
    targetThreadId: "th-1",
  });
  assert.equal(wrongParent.ok, false);
  if (!wrongParent.ok) {
    assert.equal(wrongParent.error, "Parent reply not found in this thread");
  }

  // 5. Nested reply to hidden parent -> rejected
  const hiddenParent = { id: "r-3", threadId: "th-1", isHidden: true };
  const hiddenParentReply = validateReplyTarget({
    thread: liveThread,
    parentReply: hiddenParent,
    targetThreadId: "th-1",
  });
  assert.equal(hiddenParentReply.ok, false);
});

test("Global leaderboard filters un-onboarded and 0-XP students (W3-F3)", () => {
  const rows = [
    { rank: 1, username: "top_student", totalXp: 150, isOnboarded: true },
    { rank: 2, username: "un_onboarded_user", totalXp: 100, isOnboarded: false },
    { rank: 3, username: "zero_xp_user", totalXp: 0, isOnboarded: true },
    { rank: 4, username: "current_user", totalXp: 0, isOnboarded: true, isCurrentUser: true },
  ];

  const filtered = filterGlobalLeaderboardRows(rows);
  const usernames = filtered.map((r) => r.username);

  // Un-onboarded user and 0-XP other user are excluded; top_student and current_user remain
  assert.deepEqual(usernames, ["top_student", "current_user"]);
});

test("checkSafety blocks phone numbers and emails in community posts", () => {
  assert.equal(checkSafety("How do I split my pocket money?").safe, true);
  assert.equal(checkSafety("Contact me at 9876543210 for tips").safe, false);
  assert.equal(checkSafety("Email me at student@example.com").safe, false);
});

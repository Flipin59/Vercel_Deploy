"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import { translate } from "@/shared/translate";
import { PILLARS, type Pillar } from "@/shared/types";
import { checkSafety } from "./safety";
import {
  acceptReply,
  addDemoFriendRequest,
  addDemoReply,
  addDemoThread,
  getDailyPostCreatedCount,
  getForumThreads,
  getThreadDetail,
  recordDemoPostCreated,
  reportDemoContent,
  respondDemoFriendRequest,
  searchProfiles,
  toggleDemoVote,
  validateDemoReplyTarget,
} from "./server";
import type { ForumReply, ForumThread, FriendUser, ThreadDetail, ThreadTranslation } from "./types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: string };

// --- Friends Actions (F5) ---

export async function searchProfilesAction(query: string): Promise<FriendUser[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  return searchProfiles(profile.id, query);
}

export async function sendFriendRequestAction(recipientId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };
  if (profile.id === recipientId) {
    return { success: false, error: "Cannot send request to yourself" };
  }

  if (!isSupabaseConfigured()) {
    const ok = addDemoFriendRequest(profile.id, recipientId);
    if (!ok) return { success: false, error: "Request already exists or failed" };
    revalidatePath("/forum/friends");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("forum_friends").insert({
      user_id: profile.id,
      friend_id: recipientId,
      status: "pending",
    });

    if (error) {
      // 23505: a request already exists between these two students, in either direction.
      if (error.code === "23505") return { success: false, error: "Request already exists" };
      console.error("[forum actions] sendFriendRequest error", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/forum/friends");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function respondFriendRequestAction(
  requestId: string,
  action: "accept" | "decline",
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  if (!isSupabaseConfigured()) {
    const ok = respondDemoFriendRequest(profile.id, requestId, action);
    if (!ok) return { success: false, error: "Request not found" };
    revalidatePath("/forum/friends");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const match = supabase.from("forum_friends");
    // Only a pending request addressed to this student; a stale one changes no row.
    const { data, error } = await (action === "accept"
      ? match.update({ status: "accepted", updated_at: new Date().toISOString() })
      : match.delete()
    )
      .eq("id", requestId)
      .eq("friend_id", profile.id)
      .eq("status", "pending")
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: "Request not found" };

    revalidatePath("/forum/friends");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Network error" };
  }
}

// --- Forum Threads Actions (F1, F2, F3) ---

export async function createThreadAction(data: {
  title: string;
  content: string;
  pillar: Pillar;
  tags?: string[];
}): Promise<ActionResult<string>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  const title = data.title?.trim();
  const content = data.content?.trim();

  if (!title || title.length < 5 || title.length > 200) {
    return { success: false, error: "Title must be between 5 and 200 characters", code: "error_title_length" };
  }
  if (!content || content.length < 10 || content.length > 5000) {
    return { success: false, error: "Content must be between 10 and 5000 characters", code: "error_content_length" };
  }
  if (!PILLARS.includes(data.pillar)) {
    return { success: false, error: "Invalid pillar", code: "error_invalid_pillar" };
  }

  // Safety check (F3): reject phone numbers & email addresses
  const titleSafety = checkSafety(title);
  if (!titleSafety.safe) {
    return {
      success: false,
      error: titleSafety.violation === "email" ? "Emails are not allowed for safety" : "Phone numbers are not allowed for safety",
      code: titleSafety.violation === "email" ? "error_email" : "error_phone",
    };
  }

  const contentSafety = checkSafety(content);
  if (!contentSafety.safe) {
    return {
      success: false,
      error: contentSafety.violation === "email" ? "Emails are not allowed for safety" : "Phone numbers are not allowed for safety",
      code: contentSafety.violation === "email" ? "error_email" : "error_phone",
    };
  }

  const cleanTags = (data.tags ?? [])
    .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((t) => t.length > 0)
    .slice(0, 5);

  if (!isSupabaseConfigured()) {
    const threadId = `th-${Date.now()}`;
    const newThread: ForumThread = {
      id: threadId,
      authorId: profile.id,
      authorUsername: profile.username,
      authorTitle: "Bronze 3",
      title,
      content,
      pillar: data.pillar,
      tags: cleanTags,
      upvotes: 0,
      replyCount: 0,
      createdAt: new Date().toISOString(),
    };
    addDemoThread(newThread);

    const dailyCount = await getDailyPostCreatedCount(profile.id);
    if (dailyCount < 5) {
      recordDemoPostCreated(profile.id);
      await recordActivity({
        source: "forum",
        kind: "post_created",
        pillar: data.pillar,
        xp: 2,
        ref: `post:${threadId}`,
      }).catch((err) => console.error("[forum actions] post_created XP error", err));
    }

    revalidatePath("/forum");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true, data: threadId };
  }

  try {
    const supabase = await createClient();
    const { data: inserted, error } = await supabase
      .from("forum_threads")
      .insert({
        author_id: profile.id,
        title,
        content,
        pillar: data.pillar,
        tags: cleanTags,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[forum actions] createThread error", error.message);
      return { success: false, error: error.message };
    }

    const threadId = inserted.id;
    const dailyCount = await getDailyPostCreatedCount(profile.id);
    if (dailyCount < 5) {
      await recordActivity({
        source: "forum",
        kind: "post_created",
        pillar: data.pillar,
        xp: 2,
        ref: `post:${threadId}`,
      }).catch((err) => console.error("[forum actions] post_created XP error", err));
    }

    revalidatePath("/forum");
    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
    return { success: true, data: threadId };
  } catch {
    return { success: false, error: "Failed to create thread" };
  }
}

// `data`: whether this accept paid the helper (only the first accept on a thread does).
export async function acceptReplyAction(replyId: string): Promise<ActionResult<boolean>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  const res = await acceptReply(profile.id, replyId);
  if (!res.success) {
    return { success: false, error: res.error };
  }

  // W3-F1: forum_accept_reply records the helper's 10 XP itself, once per thread, in the
  // same transaction as the accept (20261011180100_forum_accept_once.sql).
  // Note: Thread author extra 2 XP removed as per W3-F1 (not in specification)

  revalidatePath("/forum");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { success: true, data: res.awardXp };
}

export async function createReplyAction(data: {
  threadId: string;
  content: string;
  parentReplyId?: string;
}): Promise<ActionResult<string>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  const content = data.content?.trim();
  if (!content || content.length < 2 || content.length > 3000) {
    return { success: false, error: "Reply must be between 2 and 3000 characters", code: "error_content_length" };
  }

  // Safety check (F3)
  const contentSafety = checkSafety(content);
  if (!contentSafety.safe) {
    return {
      success: false,
      error: contentSafety.violation === "email" ? "Emails are not allowed for safety" : "Phone numbers are not allowed for safety",
      code: contentSafety.violation === "email" ? "error_email" : "error_phone",
    };
  }

  if (!isSupabaseConfigured()) {
    // W3-F4: Validate thread is available and parent reply belongs to same thread
    const targetCheck = validateDemoReplyTarget(data.threadId, data.parentReplyId);
    if (!targetCheck.ok) {
      return { success: false, error: targetCheck.error ?? "Invalid reply target" };
    }

    const replyId = `rep-${Date.now()}`;
    const newReply: ForumReply = {
      id: replyId,
      threadId: data.threadId,
      authorId: profile.id,
      authorUsername: profile.username,
      authorTitle: "Bronze 3",
      content,
      parentReplyId: data.parentReplyId ?? null,
      upvotes: 0,
      createdAt: new Date().toISOString(),
    };
    addDemoReply(newReply);
    revalidatePath("/forum");
    return { success: true, data: replyId };
  }

  try {
    const supabase = await createClient();

    // W3-F4: Verify thread exists and is not hidden
    const { data: thread, error: threadErr } = await supabase
      .from("forum_threads")
      .select("id, is_hidden")
      .eq("id", data.threadId)
      .maybeSingle();

    if (threadErr || !thread || thread.is_hidden) {
      return { success: false, error: "Thread not found or unavailable" };
    }

    // W3-F4: Verify parent reply if provided belongs to this thread and is not hidden
    if (data.parentReplyId) {
      const { data: parentReply, error: parentErr } = await supabase
        .from("forum_replies")
        .select("id, thread_id, is_hidden")
        .eq("id", data.parentReplyId)
        .maybeSingle();

      if (parentErr || !parentReply || parentReply.is_hidden || parentReply.thread_id !== data.threadId) {
        return { success: false, error: "Parent reply not found in this thread" };
      }
    }

    const { data: inserted, error } = await supabase
      .from("forum_replies")
      .insert({
        thread_id: data.threadId,
        author_id: profile.id,
        content,
        parent_reply_id: data.parentReplyId ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[forum actions] createReply error", error.message);
      return { success: false, error: error.message };
    }

    revalidatePath("/forum");
    return { success: true, data: inserted.id };
  } catch {
    return { success: false, error: "Failed to post reply" };
  }
}

export async function toggleVoteAction(target: {
  threadId?: string;
  replyId?: string;
}): Promise<ActionResult<{ upvotes: number; hasUpvoted: boolean }>> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  const targetId = target.threadId || target.replyId;
  if (!targetId) return { success: false, error: "Missing vote target" };

  const isReply = Boolean(target.replyId);

  if (!isSupabaseConfigured()) {
    const result = toggleDemoVote(profile.id, targetId, isReply);
    if (!result) return { success: false, error: "Post not found" };
    revalidatePath("/forum");
    return { success: true, data: result };
  }

  try {
    const supabase = await createClient();
    const targetColumn = isReply ? "reply_id" : "thread_id";
    const { data: existing, error: readError } = await supabase
      .from("forum_votes")
      .select("id")
      .eq("user_id", profile.id)
      .eq(targetColumn, targetId)
      .maybeSingle();
    if (readError) return { success: false, error: readError.message };

    // Toggle = insert or delete; forum_vote_sync keeps the count (no updates, see migration).
    const { error: writeError } = existing
      ? await supabase.from("forum_votes").delete().eq("id", existing.id)
      : await supabase.from("forum_votes").insert({ user_id: profile.id, [targetColumn]: targetId, vote_type: 1 });
    if (writeError) return { success: false, error: writeError.message };

    const { data: post, error: countError } = await supabase
      .from(isReply ? "forum_replies" : "forum_threads")
      .select("upvotes")
      .eq("id", targetId)
      .single();
    if (countError) return { success: false, error: countError.message };

    revalidatePath("/forum");
    return { success: true, data: { upvotes: post.upvotes ?? 0, hasUpvoted: !existing } };
  } catch {
    return { success: false, error: "Failed to update vote" };
  }
}

export async function reportContentAction(target: {
  threadId?: string;
  replyId?: string;
  reason: string;
}): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { success: false, error: "Not authenticated" };

  const targetId = target.threadId || target.replyId;
  if (!targetId || !target.reason) return { success: false, error: "Invalid report data" };

  const isReply = Boolean(target.replyId);

  if (!isSupabaseConfigured()) {
    reportDemoContent(targetId, isReply);
    revalidatePath("/forum");
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("forum_reports").insert({
      user_id: profile.id,
      thread_id: target.threadId ?? null,
      reply_id: target.replyId ?? null,
      reason: target.reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/forum");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to submit report" };
  }
}

export async function getThreadDetailAction(threadId: string): Promise<ThreadDetail | null> {
  const profile = await getCurrentProfile();
  return getThreadDetail(threadId, profile?.id);
}

// A thread and its visible replies in the reader's language (Telugu or Hindi; machine
// translation, cached), or null when translation is unavailable. Only the post text is
// sent to the translation service: never usernames or ids.
export async function translateThreadAction(threadId: string): Promise<ThreadTranslation | null> {
  const profile = await getCurrentProfile();
  if (!profile || profile.language === "en" || typeof threadId !== "string") return null;
  const detail = await getThreadDetail(threadId, profile.id);
  if (!detail) return null;
  const out = await translate([detail.thread.title, detail.thread.content, ...detail.replies.map((r) => r.content)], profile.language);
  if (!out) return null;
  const [title, content, ...replies] = out;
  return { title, content, replies: Object.fromEntries(detail.replies.map((r, i) => [r.id, replies[i]])) };
}

export async function getThreadsAction(filter?: {
  pillar?: Pillar;
  search?: string;
}): Promise<ForumThread[]> {
  const profile = await getCurrentProfile();
  return getForumThreads(profile?.id, filter);
}


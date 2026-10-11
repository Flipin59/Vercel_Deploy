// Server-only helpers other features call from their server code.
// Not a "use server" file: these must never be callable from the browser (IMPLEMENTATION.md §6).
import "server-only";
import { istDate } from "@/shared/progress/date";
import { getPublicProfiles, searchPublicProfiles } from "@/shared/profiles";
import { getTitle } from "@/shared/rating";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import type { Pillar, PublicProfile } from "@/shared/types";
import type {
  ForumReply,
  ForumThread,
  FriendsPageData,
  FriendUser,
  PendingFriendRequest,
  ThreadDetail,
} from "./types";
import { validateAnswerAcceptance, validateReplyTarget } from "./forumRules";

const THREADS_PAGE_SIZE = 50;

// Authors as everyone may see them: username and title, no level (RATING.md §7).
async function getAuthors(ids: string[]) {
  const authors = await getPublicProfiles(ids, { includeLevel: false });
  return new Map(authors.map((a) => [a.id, a]));
}
const UNKNOWN_AUTHOR: Pick<PublicProfile, "username" | "title" | "role"> = { username: "student", title: getTitle(1).label };

// --- In-Memory Fallback State (demo only: used only when Supabase is not configured) ---

type DemoProfileData = {
  id: string;
  username: string;
  level: number;
  title: string;
};

const DEMO_STUDENTS: DemoProfileData[] = [
  { id: "00000000-0000-0000-0000-000000000002", username: "rahul_11", level: 24, title: "Silver 2" },
  { id: "00000000-0000-0000-0000-000000000003", username: "priya_p", level: 12, title: "Bronze 1" },
  { id: "00000000-0000-0000-0000-000000000004", username: "ananya_hyd", level: 35, title: "Gold 3" },
  { id: "00000000-0000-0000-0000-000000000005", username: "vikram_99", level: 29, title: "Silver 1" },
  { id: "00000000-0000-0000-0000-000000000006", username: "kavya_fin", level: 9, title: "Bronze 2" },
];

let demoFriendships: {
  id: string;
  userId: string;
  friendId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
}[] = [
  {
    id: "fr-1",
    userId: "00000000-0000-0000-0000-000000000001",
    friendId: "00000000-0000-0000-0000-000000000002",
    status: "accepted",
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "fr-2",
    userId: "00000000-0000-0000-0000-000000000001",
    friendId: "00000000-0000-0000-0000-000000000003",
    status: "accepted",
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "fr-3",
    userId: "00000000-0000-0000-0000-000000000005",
    friendId: "00000000-0000-0000-0000-000000000001",
    status: "pending",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

const demoThreads: ForumThread[] = [
  {
    id: "th-1",
    authorId: "00000000-0000-0000-0000-000000000003",
    authorUsername: "priya_p",
    authorTitle: "Bronze 1",
    title: "How do I divide ₹500 pocket money with 50-30-20?",
    content: "My parents give me ₹500 monthly pocket money. How should I split it into needs, wants, and savings without running out by week 3?",
    pillar: "budget",
    tags: ["50-30-20", "pocket-money"],
    upvotes: 8,
    replyCount: 1,
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "th-2",
    authorId: "00000000-0000-0000-0000-000000000004",
    authorUsername: "ananya_hyd",
    authorTitle: "Gold 3",
    title: "Does compounding make a big difference with just ₹500/month?",
    content: "We learned the compound interest formula in math class. If I put ₹500 per month into a recurring deposit or index fund, how much does it actually grow?",
    pillar: "save",
    tags: ["compound-interest", "savings-goals"],
    upvotes: 12,
    replyCount: 1,
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  {
    id: "th-3",
    authorId: "00000000-0000-0000-0000-000000000002",
    authorUsername: "rahul_11",
    authorTitle: "Silver 2",
    title: "Got an SMS with an APK link for 'unpaid electricity bill' — alert!",
    content: "My parents received an SMS saying power will be disconnected at 9:30 PM unless they install an APK. Sharing here so nobody falls for it!",
    pillar: "safety",
    tags: ["upi-fraud", "phishing"],
    upvotes: 15,
    replyCount: 1,
    createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
];

const demoReplies: ForumReply[] = [
  {
    id: "rep-1",
    threadId: "th-1",
    authorId: "00000000-0000-0000-0000-000000000002",
    authorUsername: "rahul_11",
    authorTitle: "Silver 2",
    content: "Try setting aside ₹100 right away into savings (20%). Keep ₹250 for actual bus fare or snacks (50%), and ₹150 for fun with friends (30%). If you save first, you never overspend!",
    upvotes: 5,
    isAccepted: true,
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
  },
  {
    id: "rep-2",
    threadId: "th-2",
    authorId: "00000000-0000-0000-0000-000000000005",
    authorUsername: "vikram_99",
    authorTitle: "Silver 1",
    content: "At 8% p.a., ₹500/month turns into around ₹36,700 after 5 years, of which ₹6,700 is pure compound interest. Starting early while in school gives compounding time to work!",
    upvotes: 7,
    isAccepted: true,
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
  },
  {
    id: "rep-3",
    threadId: "th-3",
    authorId: "00000000-0000-0000-0000-000000000004",
    authorUsername: "ananya_hyd",
    authorTitle: "Gold 3",
    content: "DO NOT click or install that APK! It is a known remote-access screen sharing malware. Real electricity boards never send APKs or threaten instant cuts over SMS.",
    upvotes: 11,
    isAccepted: true,
    createdAt: new Date(Date.now() - 10 * 3600000).toISOString(),
  },
];

const demoVotes = new Set<string>(); // key: `${userId}:${threadIdOrReplyId}`

// --- Exported Server-Only Helpers (F5) ---

// Accepted friends of `userId`, with title and level (RATING.md §7).
export async function getFriends(userId: string): Promise<PublicProfile[]> {
  if (!isSupabaseConfigured()) {
    const acceptedRelations = demoFriendships.filter(
      (f) => f.status === "accepted" && (f.userId === userId || f.friendId === userId),
    );
    const friendIds = acceptedRelations.map((f) => (f.userId === userId ? f.friendId : f.userId));
    return DEMO_STUDENTS.filter((s) => friendIds.includes(s.id)).map((s) => ({
      id: s.id,
      username: s.username,
      title: s.title,
      level: s.level,
    }));
  }

  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("forum_friends")
      .select("user_id, friend_id")
      .eq("status", "accepted")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error) {
      console.error("[forum] getFriends error", error.message);
      throw new Error(`Failed to load friends: ${error.message}`);
    }

    if (!rows || rows.length === 0) return [];

    const friendIds = rows.map((r) => (r.user_id === userId ? r.friend_id : r.user_id));
    return await getPublicProfiles(friendIds, { includeLevel: true });
  } catch (err) {
    console.error("[forum] getFriends error", err);
    throw err;
  }
}

// Incoming friend requests waiting for `userId`; drives the header heart dot.
export async function getPendingRequestCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return demoFriendships.filter((f) => f.friendId === userId && f.status === "pending").length;
  }

  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("forum_friends")
      .select("*", { count: "exact", head: true })
      .eq("friend_id", userId)
      .eq("status", "pending");

    if (error) {
      console.error("[forum] getPendingRequestCount error", error.message);
      return 0;
    }
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function getFriendsPageData(userId: string): Promise<FriendsPageData> {
  let friends: PublicProfile[] = [];
  try {
    friends = await getFriends(userId);
  } catch (err) {
    console.error("[forum] getFriendsPageData error loading friends", err);
  }

  if (!isSupabaseConfigured()) {
    const pendingRelations = demoFriendships.filter((f) => f.friendId === userId && f.status === "pending");
    const pendingRequests: PendingFriendRequest[] = [];
    for (const rel of pendingRelations) {
      const student = DEMO_STUDENTS.find((s) => s.id === rel.userId);
      if (student) {
        pendingRequests.push({
          id: rel.id,
          requesterId: student.id,
          requesterUsername: student.username,
          requesterTitle: student.title,
          createdAt: rel.createdAt,
        });
      }
    }

    return {
      friends,
      pendingRequests,
      totalFriendsCount: friends.length,
    };
  }

  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from("forum_friends")
      .select("id, user_id, created_at")
      .eq("friend_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error || !rows) {
      return { friends, pendingRequests: [], totalFriendsCount: friends.length };
    }

    // Not friends yet, so username and title only.
    const requesters = await getAuthors(rows.map((r) => r.user_id));
    const pendingRequests: PendingFriendRequest[] = rows.map((r) => {
      const requester = requesters.get(r.user_id) ?? UNKNOWN_AUTHOR;
      return {
        id: r.id,
        requesterId: r.user_id,
        requesterUsername: requester.username,
        requesterTitle: requester.title,
        createdAt: r.created_at,
      };
    });

    return {
      friends,
      pendingRequests,
      totalFriendsCount: friends.length,
    };
  } catch (err) {
    console.error("[forum] getFriendsPageData error", err);
    return { friends, pendingRequests: [], totalFriendsCount: friends.length };
  }
}

export async function searchProfiles(userId: string, query: string): Promise<FriendUser[]> {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return [];

  if (!isSupabaseConfigured()) {
    const matching = DEMO_STUDENTS.filter(
      (s) => s.id !== userId && s.username.toLowerCase().includes(cleanQuery),
    );

    return matching.map((m) => {
      const relation = demoFriendships.find(
        (f) =>
          (f.userId === userId && f.friendId === m.id) ||
          (f.friendId === userId && f.userId === m.id),
      );

      let status: FriendUser["status"] = "none";
      if (relation) {
        if (relation.status === "accepted") {
          status = "friends";
        } else if (relation.status === "pending") {
          status = relation.userId === userId ? "pending_sent" : "pending_received";
        }
      }

      return {
        id: m.id,
        username: m.username,
        title: m.title,
        status,
      };
    });
  }

  try {
    const profiles = (await searchPublicProfiles(cleanQuery, 6)).filter((p) => p.id !== userId).slice(0, 5);
    if (profiles.length === 0) return [];

    const supabase = await createClient();
    const userIds = profiles.map((p) => p.id);

    const { data: friendships } = await supabase
      .from("forum_friends")
      .select("user_id, friend_id, status")
      .or(`and(user_id.eq.${userId},friend_id.in.(${userIds.join(",")})),and(friend_id.eq.${userId},user_id.in.(${userIds.join(",")}))`);

    return profiles.map((p) => {
      const rel = friendships?.find(
        (f) =>
          (f.user_id === userId && f.friend_id === p.id) ||
          (f.friend_id === userId && f.user_id === p.id),
      );

      let status: FriendUser["status"] = "none";
      if (rel) {
        if (rel.status === "accepted") {
          status = "friends";
        } else if (rel.status === "pending") {
          status = rel.user_id === userId ? "pending_sent" : "pending_received";
        }
      }

      return {
        id: p.id,
        username: p.username,
        title: p.title,
        status,
      };
    });
  } catch (err) {
    console.error("[forum] searchProfiles error", err);
    return [];
  }
}

// --- Forum Threads & Replies (F1, F2, F3) ---

export async function getForumThreads(
  currentUserId?: string,
  filter?: { pillar?: Pillar; search?: string },
): Promise<ForumThread[]> {
  if (!isSupabaseConfigured()) {
    let list = demoThreads.filter((t) => !t.isHidden);
    if (filter?.pillar) {
      list = list.filter((t) => t.pillar === filter.pillar);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return list.map((t) => ({
      ...t,
      hasUpvoted: currentUserId ? demoVotes.has(`${currentUserId}:${t.id}`) : false,
      isAuthor: currentUserId === t.authorId,
    }));
  }

  try {
    const supabase = await createClient();
    let query = supabase
      .from("forum_threads")
      .select("id, author_id, title, content, pillar, tags, upvotes, reply_count, created_at, is_hidden")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(THREADS_PAGE_SIZE);

    if (filter?.pillar) {
      query = query.eq("pillar", filter.pillar);
    }
    // Drop PostgREST filter syntax (, ( ) " \) and LIKE wildcards (% _ *) so the text is matched literally.
    const search = filter?.search?.replace(/[,()"\\%_*]/g, " ").trim().slice(0, 100);
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data: rows, error } = await query;
    if (error || !rows) return [];

    const authors = await getAuthors(rows.map((r) => r.author_id));

    let userVotes = new Set<string>();
    if (currentUserId) {
      const threadIds = rows.map((r) => r.id);
      const { data: votes } = await supabase
        .from("forum_votes")
        .select("thread_id")
        .eq("user_id", currentUserId)
        .in("thread_id", threadIds);

      userVotes = new Set((votes ?? []).map((v) => v.thread_id));
    }

    return rows.map((r) => {
      const author = authors.get(r.author_id) ?? UNKNOWN_AUTHOR;
      return {
        id: r.id,
        authorId: r.author_id,
        authorUsername: author.username,
        authorTitle: author.title,
        title: r.title,
        content: r.content,
        pillar: r.pillar as Pillar,
        tags: r.tags ?? [],
        upvotes: r.upvotes ?? 0,
        replyCount: r.reply_count ?? 0,
        createdAt: r.created_at,
        hasUpvoted: userVotes.has(r.id),
        isAuthor: currentUserId === r.author_id,
      };
    });
  } catch (err) {
    console.error("[forum] getForumThreads error", err);
    return [];
  }
}

export async function getThreadDetail(
  threadId: string,
  currentUserId?: string,
): Promise<ThreadDetail | null> {
  if (!isSupabaseConfigured()) {
    const thread = demoThreads.find((t) => t.id === threadId && !t.isHidden);
    if (!thread) return null;

    const replies = demoReplies
      .filter((r) => r.threadId === threadId && !r.isHidden)
      .map((r) => ({
        ...r,
        hasUpvoted: currentUserId ? demoVotes.has(`${currentUserId}:${r.id}`) : false,
        isAuthor: currentUserId === r.authorId,
      }));

    return {
      thread: {
        ...thread,
        hasUpvoted: currentUserId ? demoVotes.has(`${currentUserId}:${thread.id}`) : false,
        isAuthor: currentUserId === thread.authorId,
      },
      replies,
    };
  }

  try {
    const supabase = await createClient();
    const { data: threadRow, error: threadError } = await supabase
      .from("forum_threads")
      .select("id, author_id, title, content, pillar, tags, upvotes, reply_count, created_at, is_hidden")
      .eq("id", threadId)
      .single();

    if (threadError || !threadRow || threadRow.is_hidden) return null;

    const { data: replyRows } = await supabase
      .from("forum_replies")
      .select("id, thread_id, author_id, content, parent_reply_id, is_accepted, upvotes, created_at, is_hidden")
      .eq("thread_id", threadId)
      .eq("is_hidden", false)
      .order("created_at", { ascending: true });

    const authors = await getAuthors([threadRow.author_id, ...(replyRows ?? []).map((r) => r.author_id)]);

    let userVotedThreads = new Set<string>();
    let userVotedReplies = new Set<string>();

    if (currentUserId) {
      const replyIds = (replyRows ?? []).map((r) => r.id);
      const { data: threadVotes } = await supabase
        .from("forum_votes")
        .select("thread_id")
        .eq("user_id", currentUserId)
        .eq("thread_id", threadId);

      const { data: replyVotes } = await supabase
        .from("forum_votes")
        .select("reply_id")
        .eq("user_id", currentUserId)
        .in("reply_id", replyIds);

      userVotedThreads = new Set((threadVotes ?? []).map((v) => v.thread_id));
      userVotedReplies = new Set((replyVotes ?? []).map((v) => v.reply_id));
    }

    const threadAuthor = authors.get(threadRow.author_id) ?? UNKNOWN_AUTHOR;

    const thread: ForumThread = {
      id: threadRow.id,
      authorId: threadRow.author_id,
      authorUsername: threadAuthor.username,
      authorTitle: threadAuthor.title,
      title: threadRow.title,
      content: threadRow.content,
      pillar: threadRow.pillar as Pillar,
      tags: threadRow.tags ?? [],
      upvotes: threadRow.upvotes ?? 0,
      replyCount: threadRow.reply_count ?? 0,
      createdAt: threadRow.created_at,
      hasUpvoted: userVotedThreads.has(threadRow.id),
      isAuthor: currentUserId === threadRow.author_id,
    };

    const replies: ForumReply[] = (replyRows ?? []).map((r) => {
      const author = authors.get(r.author_id) ?? UNKNOWN_AUTHOR;
      return {
        id: r.id,
        threadId: r.thread_id,
        authorId: r.author_id,
        authorUsername: author.username,
        authorTitle: author.title,
        authorRole: author.role,
        content: r.content,
        parentReplyId: r.parent_reply_id,
        upvotes: r.upvotes ?? 0,
        isAccepted: r.is_accepted ?? false,
        createdAt: r.created_at,
        hasUpvoted: userVotedReplies.has(r.id),
        isAuthor: currentUserId === r.author_id,
      };
    });

    return { thread, replies };
  } catch (err) {
    console.error("[forum] getThreadDetail error", err);
    return null;
  }
}

// Demo mutations for in-memory fallback
export function addDemoFriendRequest(senderId: string, recipientId: string): boolean {
  if (senderId === recipientId) return false;
  const existing = demoFriendships.find(
    (f) =>
      (f.userId === senderId && f.friendId === recipientId) ||
      (f.userId === recipientId && f.friendId === senderId),
  );
  if (existing) return false;
  demoFriendships.push({
    id: `fr-${Date.now()}`,
    userId: senderId,
    friendId: recipientId,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  return true;
}

export function respondDemoFriendRequest(userId: string, requestId: string, action: "accept" | "decline"): boolean {
  const req = demoFriendships.find((f) => f.id === requestId && f.friendId === userId && f.status === "pending");
  if (!req) return false;
  if (action === "accept") {
    req.status = "accepted";
  } else {
    demoFriendships = demoFriendships.filter((f) => f.id !== requestId);
  }
  return true;
}

export function addDemoThread(thread: ForumThread) {
  demoThreads.unshift(thread);
}

export function validateDemoReplyTarget(
  threadId: string,
  parentReplyId?: string,
): { ok: boolean; error?: string } {
  const thread = demoThreads.find((t) => t.id === threadId);
  const parent = parentReplyId ? demoReplies.find((r) => r.id === parentReplyId) : null;
  const res = validateReplyTarget({
    thread,
    parentReply: parent,
    targetThreadId: threadId,
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export function addDemoReply(reply: ForumReply): boolean {
  const targetCheck = validateDemoReplyTarget(reply.threadId, reply.parentReplyId ?? undefined);
  if (!targetCheck.ok) return false;
  demoReplies.push(reply);
  const th = demoThreads.find((t) => t.id === reply.threadId);
  if (th) th.replyCount += 1;
  return true;
}

export function toggleDemoVote(
  userId: string,
  targetId: string,
  isReply: boolean,
): { upvotes: number; hasUpvoted: boolean } | null {
  const target = isReply ? demoReplies.find((r) => r.id === targetId) : demoThreads.find((t) => t.id === targetId);
  if (!target) return null;
  const key = `${userId}:${targetId}`;
  const hasUpvoted = !demoVotes.has(key);
  if (hasUpvoted) demoVotes.add(key);
  else demoVotes.delete(key);
  target.upvotes = Math.max(0, target.upvotes + (hasUpvoted ? 1 : -1));
  return { upvotes: target.upvotes, hasUpvoted };
}

export function reportDemoContent(targetId: string, isReply: boolean) {
  if (isReply) {
    const rep = demoReplies.find((r) => r.id === targetId);
    if (rep) {
      rep.isHidden = true;
    }
  } else {
    const th = demoThreads.find((t) => t.id === targetId);
    if (th) {
      th.isHidden = true;
    }
  }
}

// In-memory demo tracker for post_created events per user per IST day
const demoPostCreatedCounts = new Map<string, number>();
// In-memory demo tracker for threads that have already awarded accepted answer XP (W3-F1)
const demoAcceptedThreads = new Set<string>();

export type AcceptReplyResult =
  | { success: true; threadId: string; replyAuthorId: string; threadAuthorId: string; pillar: Pillar; awardXp: boolean }
  | { success: false; error: string };

export async function acceptReply(userId: string, replyId: string): Promise<AcceptReplyResult> {
  if (!isSupabaseConfigured()) {
    const reply = demoReplies.find((r) => r.id === replyId);
    if (!reply) return { success: false, error: "Reply not found" };

    const thread = demoThreads.find((t) => t.id === reply.threadId);
    if (!thread) return { success: false, error: "Thread not found" };

    const validation = validateAnswerAcceptance({
      currentUserId: userId,
      threadAuthorId: thread.authorId,
      replyAuthorId: reply.authorId,
      isReplyHidden: reply.isHidden,
      isThreadHidden: thread.isHidden,
      hasAcceptedAnswerAlready: demoAcceptedThreads.has(thread.id),
    });

    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    const { awardXp } = validation.data;
    if (awardXp) {
      demoAcceptedThreads.add(thread.id);
    }

    // Un-accept any previously accepted reply on this thread
    for (const r of demoReplies) {
      if (r.threadId === thread.id && r.isAccepted) {
        r.isAccepted = false;
      }
    }

    reply.isAccepted = true;
    return {
      success: true,
      threadId: thread.id,
      replyAuthorId: reply.authorId,
      threadAuthorId: thread.authorId,
      pillar: thread.pillar,
      awardXp,
    };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("forum_accept_reply", {
      p_reply_id: replyId,
    });

    if (error || !data) {
      return { success: false, error: error?.message ?? "Failed to accept reply" };
    }

    if (!data.success) {
      return { success: false, error: data.error ?? "Failed to accept reply" };
    }

    return {
      success: true,
      threadId: data.thread_id,
      replyAuthorId: data.reply_author_id,
      threadAuthorId: data.thread_author_id,
      pillar: data.pillar as Pillar,
      awardXp: Boolean(data.award_xp),
    };
  } catch (err) {
    console.error("[forum] acceptReply error", err);
    return { success: false, error: "Network or server error" };
  }
}

export async function getDailyPostCreatedCount(userId: string): Promise<number> {
  const today = istDate();
  if (!isSupabaseConfigured()) {
    return demoPostCreatedCounts.get(`${userId}:${today}`) ?? 0;
  }

  try {
    const supabase = await createClient();
    const startUtc = new Date(`${today}T00:00:00+05:30`).toISOString();
    const endUtc = new Date(`${today}T23:59:59.999+05:30`).toISOString();

    const { count, error } = await supabase
      .from("xp_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "post_created")
      .gte("created_at", startUtc)
      .lte("created_at", endUtc);

    if (error) {
      console.error("[forum] getDailyPostCreatedCount error", error.message);
      // W3-F2: Fail closed on read error to prevent exceeding daily cap
      return 5;
    }
    return count ?? 0;
  } catch {
    // W3-F2: Fail closed on network/query exception
    return 5;
  }
}

export function recordDemoPostCreated(userId: string) {
  const today = istDate();
  const key = `${userId}:${today}`;
  const current = demoPostCreatedCounts.get(key) ?? 0;
  demoPostCreatedCounts.set(key, current + 1);
}

export function resetDemoStateForTests() {
  demoAcceptedThreads.clear();
  demoPostCreatedCounts.clear();
  demoVotes.clear();
}


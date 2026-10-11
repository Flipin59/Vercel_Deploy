// Server code only — never import this from a Client Component or re-export it from a
// "use server" file (IMPLEMENTATION.md §6).
import "server-only";
import { START_RATING, getLevel, getTitle, type Title } from "../rating";
import type { FeatureName, Pillar } from "../types";
import { getCurrentProfile } from "../session";
import { createAdminClient } from "../supabase/admin";
import { isSupabaseConfigured } from "../supabase/config";

export type ActivityEvent = {
  source: FeatureName;
  // What happened, e.g. "reel_watched", "duel_won", "chapter_finished", "daily_login".
  kind: string;
  pillar?: Pillar; // set on everything except daily_login
  xp: number;
  coins?: number; // QUIZ.md §6
  ratingDelta?: number; // SCORE.md §8
  // Idempotency key, unique per user, e.g. "duel:<duelId>". A repeated ref is ignored.
  ref: string;
};

// The one way to award XP, coins and rating. The user comes from the session, and
// every amount must be worked out on the server, never taken from the client.
export async function recordActivity(event: ActivityEvent): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Authentication required");
  await record(profile.id, event);
}

// W3-S4: the same award for another student, for results the server decides for both
// sides at once (a duel's loser who left). Server code only, and only with a `userId` the
// server itself worked out (never one from the client), same rules as recordActivity.
export async function recordActivityFor(userId: string, event: ActivityEvent): Promise<void> {
  if (!(await getCurrentProfile())) throw new Error("Authentication required");
  await record(userId, event);
}

async function record(userId: string, event: ActivityEvent) {
  if (!isSupabaseConfigured()) return; // Demo never persists awards.
  if (!Number.isSafeInteger(event.xp) || event.xp < 0 ||
      !Number.isSafeInteger(event.coins ?? 0) || !Number.isSafeInteger(event.ratingDelta ?? 0) ||
      !event.ref.trim() || (event.kind !== "daily_login" && !event.pillar)) {
    throw new Error("Invalid activity");
  }
  const { error } = await createAdminClient().rpc("core_record_activity", {
    p_user: userId, p_source: event.source, p_kind: event.kind,
    p_pillar: event.pillar ?? null, p_xp: event.xp, p_coins: event.coins ?? 0,
    p_rating_delta: event.ratingDelta ?? 0, p_ref: event.ref,
  });
  if (error) throw new Error("Unable to record activity", { cause: error });
}

export type XpSummary = {
  totalXp: number;
  level: number;
  progress: number; // 0–99 XP inside the current level
  title: Title;
  rating: number;
  streakDays: number;
  pillarXp: Record<Pillar, number>;
  weeklyXp: number;
  coins: number;
};

// Only the student's own totals may leave this helper.
export async function getXpSummary(userId: string): Promise<XpSummary> {
  const profile = await getCurrentProfile();
  if (!profile || profile.id !== userId) throw new Error("Cannot read another student's progress");
  if (isSupabaseConfigured()) {
    const { data, error } = await createAdminClient().rpc("core_xp_summary", { p_user: profile.id });
    if (error || !data) throw new Error("Unable to load progress", { cause: error });
    const { level, progress } = getLevel(data.totalXp);
    return { ...data, level, progress, title: getTitle(level) };
  }
  const { level, progress } = getLevel(0);
  return {
    totalXp: 0,
    level,
    progress,
    title: getTitle(level),
    rating: START_RATING,
    streakDays: 0,
    pillarXp: { budget: 0, save: 0, invest: 0, safety: 0 },
    weeklyXp: 0,
    coins: 0,
  };
}

// Rank, username and title only — no XP, rating or coins (RATING.md §7).
export type LeaderboardRow = { rank: number; username: string; title: string; isCurrentUser: boolean };

// Ranked by XP earned in the last 7 days. `friendIds` (from getFriends) is required for "friends".
export async function getLeaderboard(
  scope: "friends" | "global",
  friendIds?: string[],
): Promise<{ rows: LeaderboardRow[]; me: LeaderboardRow | null }> {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Authentication required");
  if (scope !== "friends" && scope !== "global") throw new Error("Invalid leaderboard scope");
  if (scope === "friends" && !friendIds) throw new Error("Friends scope requires friend IDs");
  if (!isSupabaseConfigured()) return { rows: [], me: null };
  const { data, error } = await createAdminClient().rpc("core_leaderboard", {
    p_user: profile.id, p_ids: scope === "friends" ? friendIds : null,
  });
  if (error) throw new Error("Unable to load leaderboard", { cause: error });
  const all: LeaderboardRow[] = (data ?? []).map((row: {
    user_id: string; username: string; total_xp: number; rank: number;
  }) => ({
    rank: Number(row.rank), username: row.username,
    title: getTitle(getLevel(Number(row.total_xp)).level).label,
    isCurrentUser: row.user_id === profile.id,
  }));
  return { rows: all.slice(0, 50), me: all.find(row => row.isCurrentUser) ?? null };
}

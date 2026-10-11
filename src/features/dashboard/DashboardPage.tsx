import { redirect } from "next/navigation";
import { getFriends } from "@/features/forum/server";
import { CHAPTERS, chapterHref } from "@/features/learn";
import { getMyProgress } from "@/features/learn/server";
import { getContinueReelHref } from "@/features/reels/server";
import { getLeaderboard, getXpSummary } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import { BADGE_KINDS, getBadges, getWeeklyGoals } from "./badges";
import { DashboardView } from "./DashboardView";

// What badges and weekly goals are worked out from: the student's own xp_events (RLS:
// own rows only). Empty on a read error, so the dashboard still loads.
async function getActivity() {
  const kinds: Record<string, number> = {};
  if (!isSupabaseConfigured()) return { kinds, sources: [] as string[] };
  const supabase = await createClient();
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [badges, recent] = await Promise.all([
    supabase.from("xp_events").select("kind").in("kind", BADGE_KINDS).limit(2000),
    supabase.from("xp_events").select("source").gte("created_at", week).neq("kind", "daily_login").limit(2000),
  ]);
  if (badges.error || recent.error) console.error("[dashboard] activity", (badges.error ?? recent.error)!.message);
  for (const r of badges.data ?? []) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  return { kinds, sources: (recent.data ?? []).map((r) => r.source as string) };
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.onboardedAt) redirect("/onboarding");
  const [summary, progress, reelHref, friends, global, activity] = await Promise.all([
    // Same as the header (W3-S7): show the rest of the dashboard if progress can't load.
    getXpSummary(profile.id).catch(error => { console.error("[dashboard] summary", error); return null; }),
    getMyProgress(), getContinueReelHref(),
    getFriends(profile.id).then(friends => getLeaderboard("friends", friends.map(friend => friend.id)))
      .catch(error => { console.error("[dashboard] friends leaderboard", error); return null; }),
    getLeaderboard("global").catch(error => { console.error("[dashboard] global leaderboard", error); return null; }),
    getActivity(),
  ]);
  const chapter = progress.filter(p => !p.finishedAt && CHAPTERS.some(c => c.slug === p.slug))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const achievements = summary && {
    badges: getBadges({ kinds: activity.kinds, streakDays: summary.streakDays, pillarXp: summary.pillarXp }),
    goals: getWeeklyGoals(summary.weeklyXp, activity.sources),
  };
  return <DashboardView profile={profile} summary={summary} achievements={achievements}
    leaderboards={{ friends, global }}
    continueLinks={{ reel: reelHref, chapter: chapter ? chapterHref(chapter.slug) : "/learn" }} />;
}

// Server-only reads for the reels page. Not a "use server" file.
import "server-only";
import { getLastFinishedAt, getRecentWrongTags } from "@/features/play/server";
import { getXpSummary } from "@/shared/progress";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import type { ContentItem, Profile, RecUser, Tag } from "@/shared/types";
import { reelsForLanguage, type Reel } from "./manifest";

export type ReelCardData = Reel & { videoUrl: string; likes: number | null };

// The feed is ranked in the browser (ReelsFeed), after it drops the reels this tab has
// already shown (RECOMMENDATION.md §8). `seed` and `now` make the ranking the same on the
// server and the client.
export type ReelsPageData = {
  reels: ReelCardData[]; // every reel in the student's language, for lookups
  items: ContentItem[]; // candidates: minus reels completed in the last 30 days
  user: RecUser;
  seed: number;
  now: number;
  liked: string[];
  saved: string[];
  viewedSinceQuiz: string[]; // drives the 5-reel quiz gate, kept across visits
  startId?: string; // a shared link's reel: shown even if already seen this session
};

type Stats = ContentItem["stats"];
type EventRow = { reel_id: string; kind: string; created_at: string };

const DAY_MS = 24 * 60 * 60 * 1000;
// Tag interest points per event in the last 14 days (RECOMMENDATION.md §3). Likes and
// saves come from the current reactions, so toggling one doesn't count it twice.
const INTEREST: Record<string, number> = { save: 3, like: 2, complete: 1, skip: -1 };
const HISTORY_LIMIT = 1000;

// Clips live in the public `reels` Storage bucket, one folder per language (`file` in the
// manifest, e.g. "English/banking.mp4"). Without Supabase (local demo) the same path is
// looked up under public/media/reels.
function videoUrl(file: string): string {
  const path = file.split("/").map(encodeURIComponent).join("/");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/reels/${path}` : `/media/reels/${path}`;
}

// R4: candidates and the student for Play's buildFeed (RECOMMENDATION.md §2–4, §8).
export async function loadReelsPage(profile: Profile, startId?: string): Promise<ReelsPageData> {
  const all = reelsForLanguage(profile.language).map((r) => ({ ...r, videoUrl: videoUrl(r.file), likes: null as number | null }));
  const now = Date.now();
  const liked: string[] = [];
  const saved: string[] = [];
  let viewedSinceQuiz: string[] = [];
  // Only a finished reel quiz resets the 5-reel count (D7); Play's attempts record that.
  const [summary, recentWrongTags, lastQuiz] = await Promise.all([
    getXpSummary(profile.id),
    getRecentWrongTags(),
    getLastFinishedAt("reel"),
  ]);
  let recent: EventRow[] = [];
  let reactions: EventRow[] = [];
  let watched = 0;
  const stats = new Map<string, Stats>();
  const friendsEngaged = new Map<string, number>();

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const since = new Date(now - 30 * DAY_MS).toISOString();
    let sinceQuiz = supabase
      .from("reels_events")
      .select("reel_id")
      .eq("user_id", profile.id)
      .eq("kind", "view")
      .order("created_at")
      .limit(100);
    if (lastQuiz) sinceQuiz = sinceQuiz.gt("created_at", lastQuiz);
    const [reactionsRes, events, recentEvents, views, statsRes, friendsRes] = await Promise.all([
      supabase.from("reels_reactions").select("reel_id, kind, created_at").eq("user_id", profile.id),
      sinceQuiz,
      supabase
        .from("reels_events")
        .select("reel_id, kind, created_at")
        .eq("user_id", profile.id)
        .in("kind", ["complete", "skip"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase.from("reels_events").select("reel_id").eq("user_id", profile.id).eq("kind", "view").limit(HISTORY_LIMIT),
      supabase.rpc("reels_item_stats", { p_since: since }),
      supabase.rpc("reels_friends_engaged"),
    ]);

    if (reactionsRes.error) console.warn("[reels] reactions", reactionsRes.error.message);
    reactions = reactionsRes.data ?? [];
    for (const row of reactions) (row.kind === "like" ? liked : saved).push(row.reel_id);

    if (events.error) console.warn("[reels] events", events.error.message);
    viewedSinceQuiz = [...new Set((events.data ?? []).map((e) => e.reel_id as string))];

    if (recentEvents.error || views.error) console.warn("[reels] history", (recentEvents.error ?? views.error)!.message);
    recent = recentEvents.data ?? [];
    watched = new Set((views.data ?? []).map((v) => v.reel_id)).size;

    if (statsRes.error) console.warn("[reels] stats", statsRes.error.message);
    type StatsRow = { reel_id: string; views: number; completions: number; likes: number; recent_likes: number; recent_saves: number };
    for (const s of (statsRes.data ?? []) as StatsRow[]) {
      // Popularity uses 30-day likes and saves; the counter on the reel shows all-time likes.
      stats.set(s.reel_id, { views: Number(s.views), completions: Number(s.completions), likes: Number(s.recent_likes), saves: Number(s.recent_saves) });
      const reel = all.find((r) => r.id === s.reel_id);
      if (reel) reel.likes = Number(s.likes);
    }
    if (!statsRes.error) for (const r of all) r.likes ??= 0;

    if (friendsRes.error) console.warn("[reels] friends", friendsRes.error.message);
    for (const f of (friendsRes.data ?? []) as { reel_id: string; friends: number }[]) friendsEngaged.set(f.reel_id, Number(f.friends));
  }

  const byId = new Map(all.map((r) => [r.id, r]));
  const tagInterest: Partial<Record<Tag, number>> = {};
  const completed = new Set<string>();
  for (const e of [...recent, ...reactions]) {
    const reel = byId.get(e.reel_id);
    if (!reel) continue;
    if (e.kind === "complete") completed.add(reel.id);
    if (now - Date.parse(e.created_at) <= 14 * DAY_MS) {
      for (const t of reel.tags) tagInterest[t] = (tagInterest[t] ?? 0) + INTEREST[e.kind];
    }
  }
  const user: RecUser = {
    id: profile.id, level: summary.level, language: profile.language, pillarXp: summary.pillarXp,
    tagInterest, recentWrongTags, reelsWatched: watched, chaptersOpened: 0, persona: profile.persona,
  };
  const items: ContentItem[] = all.filter((r) => !completed.has(r.id)).map((r) => ({
    id: r.id, kind: "reel", pillar: r.pillar, tags: r.tags, level: r.level, createdAt: r.createdAt,
    // English stands in for reels not made in the student's language yet (manifest.ts),
    // so it counts as their version here.
    language: profile.language,
    stats: stats.get(r.id) ?? { views: 0, likes: 0, saves: 0, completions: 0 },
    friendsEngaged: friendsEngaged.get(r.id) ?? 0,
  }));
  const seed = Math.floor(Math.random() * 2 ** 32);
  return { reels: all, items, user, seed, now, liked, saved, viewedSinceQuiz, startId };
}

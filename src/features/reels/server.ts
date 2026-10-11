import "server-only";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import { reelHref } from "./index";
import { reelsForLanguage } from "./manifest";

// Dashboard's Continue URL; the user always comes from the verified session.
export async function getContinueReelHref(): Promise<string> {
  const profile = await getCurrentProfile();
  if (!profile || !isSupabaseConfigured()) return reelHref();
  const ids = reelsForLanguage(profile.language).map(reel => reel.id);
  if (!ids.length) return reelHref();
  const supabase = await createClient();
  const { data, error } = await supabase.from("reels_events").select("reel_id")
    .eq("user_id", profile.id).eq("kind", "view").in("reel_id", ids)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    console.error("[reels] continue", error);
    return reelHref();
  }
  return reelHref(data?.reel_id ?? undefined);
}

// Distinct reels the signed-in student has viewed (≥ 3 s), for RecUser.reelsWatched
// (RECOMMENDATION.md §3: new-user weights until 20).
export async function getReelsWatched(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { data, error } = await supabase.from("reels_events").select("reel_id").eq("kind", "view").limit(1000);
  if (error) {
    console.warn("[reels] getReelsWatched", error.message);
    return 0;
  }
  return new Set(data.map((r) => r.reel_id)).size;
}

// Reels the signed-in student watched (≥ 3 s) in the last 7 days, for Play's practice
// selection (+3 for questions linked to them, QUESTIONS.md §4). Empty on any error.
export async function getRecentReelIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("reels_events").select("reel_id")
    .eq("kind", "view").gte("created_at", since).limit(1000);
  if (error) {
    console.warn("[reels] getRecentReelIds", error.message);
    return [];
  }
  return [...new Set(data.map((r) => r.reel_id as string))];
}

// Which of these reels the signed-in student completed (watched ≥ 80%), for Play's reel
// quiz, which prefers questions on completed reels (QUESTIONS.md §6). Empty on any error.
export async function getCompletedReelIds(reelIds: string[]): Promise<string[]> {
  if (!reelIds.length || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("reels_events").select("reel_id")
    .eq("kind", "complete").in("reel_id", reelIds).limit(1000);
  if (error) {
    console.warn("[reels] getCompletedReelIds", error.message);
    return [];
  }
  return [...new Set(data.map((r) => r.reel_id as string))];
}

"use server";
// Public endpoints: anyone signed in can call these with any arguments. The user comes
// from the session and every XP amount is decided here (IMPLEMENTATION.md §6).
import { recordActivity } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import { getReel } from "./manifest";

const REEL_WATCHED_XP = 1; // SCORE.md §6, once per reel ever
const CLIENT_KINDS = ["view", "complete", "skip", "share"] as const;

// Logs what the player saw. A completed view also earns `reel_watched` XP, but only
// after a view of the same reel was logged.
export async function logReelEvent(reelId: string, kind: (typeof CLIENT_KINDS)[number]): Promise<void> {
  const reel = typeof reelId === "string" ? getReel(reelId) : undefined;
  if (!reel || !CLIENT_KINDS.includes(kind)) return;
  const profile = await getCurrentProfile();
  if (!profile) return;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    if (kind === "complete") {
      const { count, error } = await supabase
        .from("reels_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("reel_id", reel.id)
        .eq("kind", "view");
      if (error || !count) return;
    }
    const { error } = await supabase.from("reels_events").insert({ user_id: profile.id, reel_id: reel.id, kind });
    if (error) {
      console.warn("[reels] logReelEvent", error.message);
      return;
    }
  }

  if (kind === "complete") {
    try {
      await recordActivity({
        source: "reels",
        kind: "reel_watched",
        pillar: reel.pillar,
        xp: REEL_WATCHED_XP,
        ref: `reel_watched:${reel.id}`,
      });
    } catch (error) {
      // A lost 1 XP award is not worth an error on the student's screen.
      console.warn("[reels] reel_watched XP", error);
    }
  }
}

// Sets like/save to `on`. Logs an event only when the state actually changes.
// False when it could not be stored, so the client undoes its optimistic update.
export async function setReaction(reelId: string, kind: "like" | "save", on: boolean): Promise<boolean> {
  const reel = typeof reelId === "string" ? getReel(reelId) : undefined;
  if (!reel || (kind !== "like" && kind !== "save") || typeof on !== "boolean") return false;
  if (!isSupabaseConfigured()) return true; // demo: kept in the page only
  const profile = await getCurrentProfile();
  if (!profile) return false;

  const supabase = await createClient();
  const row = { user_id: profile.id, reel_id: reel.id, kind };
  let changed: boolean;
  if (on) {
    const { error } = await supabase.from("reels_reactions").insert(row);
    if (error && error.code !== "23505") {
      console.warn("[reels] setReaction", error.message);
      return false;
    }
    changed = !error;
  } else {
    const { data, error } = await supabase.from("reels_reactions").delete().match(row).select("reel_id");
    if (error) {
      console.warn("[reels] setReaction", error.message);
      return false;
    }
    changed = Boolean(data?.length);
  }
  if (changed) {
    const event = on ? kind : (`un${kind}` as const);
    await supabase.from("reels_events").insert({ user_id: profile.id, reel_id: reel.id, kind: event });
  }
  return true;
}

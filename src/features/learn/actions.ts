"use server";

// Public endpoint: anyone can call it with anything, so every argument is checked and the
// student comes from the session. Progress isn't XP; nothing here awards points.
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import { LANGUAGES, type Language } from "@/shared/types";
import { CHAPTERS } from "./chapters";
import { getPageCount } from "./server";

// Remembers the page a student reached. The first call opens the chapter; reaching the
// last page marks it finished (RECOMMENDATION.md §1).
export async function saveProgress(slug: string, page: number, language: Language): Promise<void> {
  if (
    !isSupabaseConfigured() ||
    !CHAPTERS.some((c) => c.slug === slug) ||
    !LANGUAGES.includes(language) ||
    !Number.isInteger(page)
  ) {
    return;
  }
  const total = await getPageCount(slug, language);
  if (page < 1 || page > total) return;
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("learn_progress")
    .upsert(
      { user_id: profile.id, chapter_slug: slug, last_page: page, updated_at: now },
      { onConflict: "user_id,chapter_slug" },
    );
  if (error) {
    console.error("[learn] saveProgress", error.message);
    return;
  }
  if (page === total) {
    await supabase
      .from("learn_progress")
      .update({ finished_at: now })
      .eq("user_id", profile.id)
      .eq("chapter_slug", slug)
      .is("finished_at", null);
  }
}

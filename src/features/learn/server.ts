// Server-only helpers. Not a "use server" file: nothing here is callable from the browser.
import "server-only";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { scoreItem } from "@/features/play";
import { getAttemptResult, getRecentWrongTags } from "@/features/play/server";
import { getReelsWatched } from "@/features/reels/server";
import { getXpSummary, recordActivity } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { createClient } from "@/shared/supabase/server";
import { LANGUAGES, type ContentItem, type Language, type RecUser, type Tag } from "@/shared/types";
import { CHAPTERS } from "./chapters";
import type { ChapterProgress } from "./recommend";

// Rendered by contents/pdfs/render.sh. On Vercel this folder must be in the output trace
// (`outputFileTracingIncludes` in next.config.ts) — requested from platform.
const PAGES_DIR = path.join(process.cwd(), "contents", "pdfs", "pages");

export async function getPageCount(slug: string, language: Language): Promise<number> {
  try {
    const files = await readdir(path.join(PAGES_DIR, `${slug}.${language}`));
    return files.filter((f) => /^\d+\.jpg$/.test(f)).length;
  } catch {
    return 0;
  }
}

// The version to show: the student's language if that chapter has it, else English.
export async function getVariant(slug: string, language: Language): Promise<{ language: Language; pages: number }> {
  const pages = await getPageCount(slug, language);
  if (pages > 0 || language === "en") return { language, pages };
  return { language: "en", pages: await getPageCount(slug, "en") };
}

// The chapter's PDF in the student's language, else English, or null if it has none
// (contents/pdfs/<slug>.<lang>.pdf). For the download button (classroom / offline use).
export async function readPdf(slug: string): Promise<{ name: string; file: Buffer } | null> {
  if (!CHAPTERS.some((c) => c.slug === slug)) return null;
  const profile = await getCurrentProfile();
  for (const language of new Set([profile?.language ?? "en", "en"])) {
    const name = `${slug}.${language}.pdf`;
    try {
      return { name, file: await readFile(path.join(PAGES_DIR, "..", name)) };
    } catch {
      // No PDF in this language.
    }
  }
  return null;
}

// Whether the download button has anything to serve.
export async function hasPdf(slug: string, language: Language): Promise<boolean> {
  const exists = (l: Language) => access(path.join(PAGES_DIR, "..", `${slug}.${l}.pdf`)).then(() => true, () => false);
  return (await exists(language)) || (await exists("en"));
}

// One page image, or null. All three values come from the URL, so they are checked
// before touching the file system.
export async function readPage(slug: string, language: string, page: string): Promise<Buffer | null> {
  if (
    !CHAPTERS.some((c) => c.slug === slug) ||
    !LANGUAGES.includes(language as Language) ||
    !/^[1-9]\d{0,3}$/.test(page)
  ) {
    return null;
  }
  try {
    return await readFile(path.join(PAGES_DIR, `${slug}.${language}`, `${page}.jpg`));
  } catch {
    return null;
  }
}

// The signed-in student's progress (row-level security returns only their rows).
export async function getMyProgress(): Promise<ChapterProgress[]> {
  if (!isSupabaseConfigured()) return []; // no-database demo: progress isn't stored
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learn_progress")
    .select("chapter_slug, last_page, updated_at, finished_at");
  if (error) {
    console.error("[learn] getMyProgress", error.message);
    return [];
  }
  return data.map((r) => ({
    slug: r.chapter_slug,
    lastPage: r.last_page,
    updatedAt: r.updated_at,
    finishedAt: r.finished_at,
  }));
}

// Opened / finished counts per chapter over the last 30 days, for popularity.
export async function getChapterStats(): Promise<Map<string, { opened: number; finished: number }>> {
  const stats = new Map<string, { opened: number; finished: number }>();
  if (!isSupabaseConfigured()) return stats;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("learn_chapter_stats");
  if (error) {
    console.error("[learn] getChapterStats", error.message);
    return stats;
  }
  for (const r of data as { chapter_slug: string; opened: number; finished: number }[]) {
    stats.set(r.chapter_slug, { opened: Number(r.opened), finished: Number(r.finished) });
  }
  return stats;
}

// Chapters the signed-in student opened or turned a page in during the last 7 days, for
// Play's practice selection (+3, QUESTIONS.md §4). Empty on any error.
export async function getRecentChapterSlugs(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("learn_progress").select("chapter_slug").gte("updated_at", since);
  if (error) {
    console.error("[learn] recent chapters", error.message);
    return [];
  }
  return data.map((r) => r.chapter_slug as string);
}

// Friends who finished each chapter in the last 14 days (RECOMMENDATION.md §3). Counts only.
async function getFriendsEngaged(): Promise<Map<string, number>> {
  const friends = new Map<string, number>();
  if (!isSupabaseConfigured()) return friends;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("learn_friends_engaged");
  if (error) {
    console.error("[learn] friends engaged", error.message);
    return friends;
  }
  for (const r of data as { chapter_slug: string; friends: number }[]) friends.set(r.chapter_slug, Number(r.friends));
  return friends;
}

const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

// +1 per tag of each chapter finished in the last 14 days (RECOMMENDATION.md §3; chapters
// have no likes or saves, so "completed" is the only signal).
export function tagInterestOf(progress: ChapterProgress[]): Partial<Record<Tag, number>> {
  const interest: Partial<Record<Tag, number>> = {};
  for (const p of progress) {
    if (!p.finishedAt || Date.now() - Date.parse(p.finishedAt) > FOURTEEN_DAYS) continue;
    for (const tag of CHAPTERS.find((c) => c.slug === p.slug)?.tags ?? []) interest[tag] = (interest[tag] ?? 0) + 1;
  }
  return interest;
}

// The student and the chapters (in their language) as Play's scoreItem sees them
// (RECOMMENDATION.md §8). Used by the library and by the quiz's "Learn more" link.
export async function getRecommendationInput() {
  const profile = await getCurrentProfile();
  const language = profile?.language ?? "en";
  const [summary, progress, stats, variants, recentWrongTags, reelsWatched, friends] = await Promise.all([
    profile ? getXpSummary(profile.id) : null,
    getMyProgress(),
    getChapterStats(),
    Promise.all(CHAPTERS.map((c) => getVariant(c.slug, language))),
    getRecentWrongTags(),
    getReelsWatched(),
    getFriendsEngaged(),
  ]);
  const ready = CHAPTERS.map((c, i) => ({ ...c, ...variants[i] })).filter((c) => c.pages > 0);
  const user: RecUser = {
    id: profile?.id ?? "",
    level: summary?.level ?? 1,
    language,
    pillarXp: summary?.pillarXp ?? { budget: 0, save: 0, invest: 0, safety: 0 },
    tagInterest: tagInterestOf(progress),
    recentWrongTags,
    reelsWatched,
    chaptersOpened: progress.length,
    persona: profile?.persona,
  };
  const items: ContentItem[] = ready.map((c) => ({
    id: c.slug,
    kind: "chapter",
    pillar: c.pillar,
    tags: c.tags,
    level: c.level,
    language: c.language,
    createdAt: c.createdAt,
    requires: c.requires,
    stats: { views: stats.get(c.slug)?.opened ?? 0, likes: 0, saves: 0, completions: stats.get(c.slug)?.finished ?? 0 },
    friendsEngaged: friends.get(c.slug) ?? 0,
  }));
  return { progress, ready, user, items };
}

// For each tag, the top-scored chapter that has it (RECOMMENDATION.md §4: the reel quiz's
// "Learn more" after a wrong answer). Tags with no chapter are left out.
export async function getLearnMoreLinks(tags: Tag[]): Promise<Partial<Record<Tag, string>>> {
  if (!tags.length) return {};
  const { user, items } = await getRecommendationInput();
  const ranked = items.map((i) => ({ i, score: scoreItem(i, user, items) })).sort((a, b) => b.score - a.score);
  const links: Partial<Record<Tag, string>> = {};
  for (const tag of tags) {
    const best = ranked.find((r) => r.i.tags.includes(tag));
    if (best) links[tag] = best.i.id;
  }
  return links;
}

export const CHAPTER_BONUS_XP = 10; // SCORE.md §3, once per chapter
const CHECK_QUESTIONS = 5; // QUIZ.md §1: the chapter check is 5 questions
const PASS_RATIO = 0.6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What happened to the bonus: earned now, earned on an earlier visit, score under 60%,
// chapter not read to the last page (W3-L3), not the first check of the chapter (W3-P6), or the
// award failed (reload retries it).
export type ChapterBonus = "earned" | "already" | "missed" | "unread" | "retake" | "error";

// The chapter check result for an attempt the quiz sent back (`?attempt=`), awarding the
// chapter_finished bonus at ≥ 60% of 5 on the student's first check of the chapter, after reading
// the chapter to the last page (SCORE.md §3, IMPLEMENTATION.md §6). Null if the attempt isn't this student's check for this chapter.
// The ref makes repeat visits award nothing.
export async function checkChapterAttempt(slug: string, attemptId: string) {
  const chapter = CHAPTERS.find((c) => c.slug === slug);
  if (!chapter || !UUID.test(attemptId)) return null;
  const result = await getAttemptResult(attemptId).catch((error) => {
    console.error("[learn] chapter check", error);
    return null;
  });
  if (!result || result.context !== "chapter" || result.chapterSlug !== slug || result.total === 0) return null;
  // Over 5, not over the questions served: a short bank can't make the bar easier.
  const total = Math.max(result.total, CHECK_QUESTIONS);
  const check = (bonus: ChapterBonus) => ({ correct: result.correct, total, bonus });
  if (result.correct / total < PASS_RATIO) return check("missed");

  const ref = `chapter_finished:${slug}`;
  try {
    // Own rows only (RLS, §6). A read error becomes "error", never "unread": the ref keeps
    // the award itself once-only, so reloading retries safely.
    const supabase = await createClient();
    const [earned, progress] = await Promise.all([
      supabase.from("xp_events").select("id").eq("ref", ref).maybeSingle(),
      supabase.from("learn_progress").select("finished_at").eq("chapter_slug", slug).maybeSingle(),
    ]);
    if (earned.error) throw earned.error;
    if (progress.error) throw progress.error;
    if (earned.data) return check("already");
    if (!progress.data?.finished_at) return check("unread");
    if (!result.firstCheck) return check("retake");
    await recordActivity({ source: "learn", kind: "chapter_finished", pillar: chapter.pillar, xp: CHAPTER_BONUS_XP, ref });
    return check("earned");
  } catch (error) {
    console.error("[learn] chapter bonus", error);
    return check("error");
  }
}

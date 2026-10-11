// Server-only helpers other features call from their server code. Not a "use server"
// file: these must never be callable from the browser (IMPLEMENTATION.md §6).
import "server-only";
import { getCurrentProfile } from "@/shared/session";
import { createAdminClient } from "@/shared/supabase/admin";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import type { Tag } from "@/shared/types";
import type { QuizContext } from "./types";

// First-try score of one of the signed-in student's quiz attempts, for Learn's chapter
// bonus (SCORE.md §3): check context and chapterSlug before awarding. `firstCheck` is false
// when the student answered anything in an earlier check for the same chapter: only the
// first check may earn the bonus (W3-P6). Started, not finished: otherwise revealing the
// answers and quitting before the last question would allow a free retake. Null when the attempt isn't theirs, doesn't exist, or
// there is no database (demo).
export async function getAttemptResult(attemptId: string): Promise<{
  context: QuizContext; chapterSlug: string | null; correct: number; total: number; firstCheck: boolean;
} | null> {
  const profile = await getCurrentProfile();
  if (!profile || !isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const [{ data: attempt }, { data: answers }] = await Promise.all([
    db.from("play_attempts").select("context, chapter_slug, question_ids, created_at").eq("id", attemptId).eq("user_id", profile.id).maybeSingle(),
    db.from("play_answers").select("correct").eq("attempt_id", attemptId).eq("user_id", profile.id).eq("try", 1),
  ]);
  if (!attempt) return null;
  let firstCheck = true;
  if (attempt.context === "chapter") {
    const { data: earlier } = await db.from("play_attempts").select("id").eq("user_id", profile.id)
      .eq("context", "chapter").eq("chapter_slug", attempt.chapter_slug).lt("created_at", attempt.created_at);
    if (earlier?.length) {
      const { data: answered } = await db.from("play_answers").select("id")
        .in("attempt_id", earlier.map((a) => a.id)).eq("try", 1).limit(1);
      firstCheck = !answered?.length;
    }
  }
  return {
    context: attempt.context,
    chapterSlug: attempt.chapter_slug,
    correct: (answers ?? []).filter((a) => a.correct).length,
    total: attempt.question_ids.length,
    firstCheck,
  };
}

// When each attempt was finished (every question has a first-try answer; a timeout counts),
// or null. An attempt with no questions is never finished (W3-P5).
async function finishedAt(db: ReturnType<typeof createAdminClient>, attempts: { id: string; question_ids: string[]; created_at?: string }[]) {
  const { data: answers } = await db.from("play_answers").select("attempt_id, answered_at")
    .in("attempt_id", attempts.map((a) => a.id)).eq("try", 1);
  return attempts.map((a) => {
    const times = (answers ?? []).filter((x) => x.attempt_id === a.id).map((x) => Date.parse(x.answered_at));
    if (!a.question_ids.length || times.length < a.question_ids.length) return null;
    return Math.max(Date.parse(a.created_at ?? "0"), ...times);
  });
}

// Auth's onboarding status and Play's resume path share the same persisted attempt.
// No answer keys leave this server-only helper.
export async function getPlacementAttempt(): Promise<{
  attemptId: string; questionIds: string[]; answeredIds: string[]; correct: number;
  shownQuestion: string | null; // on screen when the student last left (showQuestion)
} | null> {
  const profile = await getCurrentProfile();
  if (!profile || !isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const { data: attempt, error } = await db.from("play_attempts")
    .select("id, question_ids, shown_question").eq("user_id", profile.id).eq("context", "placement").maybeSingle();
  if (error) throw new Error("Unable to load placement", { cause: error });
  if (!attempt) return null;
  const { data: answers, error: answerError } = await db.from("play_answers")
    .select("question_id, correct").eq("user_id", profile.id).eq("attempt_id", attempt.id).eq("try", 1);
  if (answerError) throw new Error("Unable to load placement answers", { cause: answerError });
  return {
    attemptId: attempt.id, questionIds: attempt.question_ids,
    answeredIds: (answers ?? []).map(a => a.question_id),
    correct: (answers ?? []).filter(a => a.correct).length,
    shownQuestion: attempt.shown_question,
  };
}

// When the signed-in student last finished a quiz of this context: every question has a
// first-try answer (a timeout counts). Null if never, or with no database. Reels resets its
// 5-reel quiz gate with this, so only a finished reel quiz clears it (D7).
export async function getLastFinishedAt(context: QuizContext): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || !isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const { data: attempts } = await db.from("play_attempts").select("id, question_ids, created_at")
    .eq("user_id", profile.id).eq("context", context).order("created_at", { ascending: false }).limit(20);
  if (!attempts?.length) return null;
  const done = (await finishedAt(db, attempts)).filter((at) => at !== null);
  return done.length ? new Date(Math.max(...done)).toISOString() : null;
}

// Tags of questions the signed-in student answered wrong (quiz first tries and duels) in
// the last 7 days, for the "wrong answer → content that explains it" rule
// (RECOMMENDATION.md §3, RecUser.recentWrongTags). Empty without a database (demo).
export async function getRecentWrongTags(): Promise<Tag[]> {
  const profile = await getCurrentProfile();
  if (!profile || !isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [quiz, duel] = await Promise.all([
    db.from("play_answers").select("question_id").eq("user_id", profile.id).eq("try", 1).eq("correct", false).gte("answered_at", since),
    db.from("play_duel_answers").select("question_id").eq("user_id", profile.id).eq("correct", false).gte("answered_at", since),
  ]);
  const ids = [...new Set([...(quiz.data ?? []), ...(duel.data ?? [])].map((r) => r.question_id))];
  if (!ids.length) return [];
  const { data } = await db.from("play_questions").select("tags").in("id", ids);
  return [...new Set((data ?? []).flatMap((q: { tags: Tag[] }) => q.tags))];
}

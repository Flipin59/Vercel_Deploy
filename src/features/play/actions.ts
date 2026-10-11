"use server";

// Quiz engine server actions (QUESTIONS.md §9, IMPLEMENTATION.md §6). Every export here
// is a public endpoint: the user comes from the session and every amount is worked out
// here. Without Supabase (local demo) the JSON bank's live questions are served, scored
// as practice, and nothing is saved.
import { REELS } from "@/features/reels";
import { getRecentChapterSlugs } from "@/features/learn/server";
import { getCompletedReelIds, getRecentReelIds } from "@/features/reels/server";
import { getXpSummary, recordActivity } from "@/shared/progress";
import { istDate } from "@/shared/progress/date";
import { getCurrentProfile } from "@/shared/session";
import { createAdminClient } from "@/shared/supabase/admin";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { PILLARS, type Pillar } from "@/shared/types";
import { BANK_COLUMNS, DEMO_BANK } from "./bank";
import { xpTowardDailyCap } from "./duelStore";
import { pick, scoreFirstTry, type BankQuestion, type FirstTry } from "./engine";
import { getPlacementAttempt } from "./server";
import { CHOICE_SIMS, SIM, isChoiceSim, runChoiceSim, runSim } from "./sim";
import { QUIZ_COUNTS, type AnswerResult, type PickQuestionsInput, type QuizContext, type QuizQuestion, type SubmitAnswerInput } from "./types";

const LATENCY_MS = 5_000;
const SOURCE = { practice: "play", placement: "play", chapter: "learn", reel: "reels" } as const;
const KIND = { chapter: "chapter_check_answer", reel: "reel_quiz_answer", placement: "placement" } as const;

async function session() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Authentication required");
  const summary = await getXpSummary(profile.id);
  return { profile, summary, db: isSupabaseConfigured() ? createAdminClient() : null };
}

function must<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error || data == null) throw new Error("Quiz data unavailable", { cause: error });
  return data as NonNullable<T>;
}

const toFirstTry = (r: { question_id: string; correct: boolean; answered_at: string }): FirstTry =>
  ({ questionId: r.question_id, correct: r.correct, at: Date.parse(r.answered_at) });

export async function pickQuestions(input: PickQuestionsInput): Promise<{ attemptId: string; questions: QuizQuestion[] }> {
  const { context } = input;
  if (!Object.hasOwn(QUIZ_COUNTS, context)) throw new Error("Invalid quiz context");
  const { profile, summary, db } = await session();
  if (context === "placement" && profile.onboardedAt) throw new Error("Placement is only during onboarding");

  if (context === "placement" && db) {
    const existing = await getPlacementAttempt();
    if (existing) return resumePlacement(db, existing, profile.id, profile.language, summary.rating);
  }

  let bank = DEMO_BANK;
  let history: FirstTry[] = [];
  let shown = new Set<string>();
  if (db) {
    const [questions, answers, attempts] = await Promise.all([
      db.from("play_questions").select(BANK_COLUMNS).eq("status", "live"),
      db.from("play_answers").select("question_id, correct, answered_at").eq("user_id", profile.id).eq("try", 1).order("answered_at"),
      db.from("play_attempts").select("question_ids").eq("user_id", profile.id)
        .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    ]);
    bank = must(questions) as BankQuestion[];
    history = must(answers).map(toFirstTry);
    shown = new Set(must(attempts).flatMap((a: { question_ids: string[] }) => a.question_ids));
  }
  // QUESTIONS.md §4: +3 for questions on reels/chapters from the last 7 days (practice only).
  const [recentReels, recentChapters] = context === "practice"
    ? await Promise.all([getRecentReelIds(), getRecentChapterSlugs()])
    : [[], []];
  const picked = pick(context, {
    bank, history, shown, language: profile.language, rating: summary.rating, pillarXp: summary.pillarXp,
    pillar: input.pillar && PILLARS.includes(input.pillar) ? input.pillar : undefined,
    reelIds: input.reelIds, chapterSlug: input.chapterSlug,
    reelTags: [...new Set(REELS.filter((r) => input.reelIds?.includes(r.id)).flatMap((r) => r.tags))],
    completedReels: context === "reel" ? await getCompletedReelIds(input.reelIds ?? []) : [],
    recentReels, recentChapters,
  });

  if (context === "placement" && picked.length !== QUIZ_COUNTS.placement) {
    throw new Error("Placement question bank is incomplete");
  }
  // Nothing to ask (no linked questions, unknown chapter): no attempt, so an empty quiz
  // never counts as finished (W3-P5).
  if (!picked.length) return { attemptId: "", questions: [] };
  let attemptId: string = crypto.randomUUID();
  if (db) {
    const { data, error } = await db.from("play_attempts").insert({
      user_id: profile.id, context, question_ids: picked.map((q) => q.id),
      chapter_slug: context === "chapter" ? input.chapterSlug : null,
    }).select("id").single();
    // play_attempts_one_placement: one placement attempt per student, ever (RATING.md §4).
    if (error?.code === "23505" && context === "placement") {
      const existing = await getPlacementAttempt();
      if (existing) return resumePlacement(db, existing, profile.id, profile.language, summary.rating);
    }
    attemptId = must({ data, error }).id;
  }
  return {
    attemptId,
    questions: picked.map((q) => {
      const local = q.content[profile.language];
      const { prompt, options } = local ?? q.content.en!;
      return { id: q.id, type: q.type, pillar: q.pillar, tag: q.tags[0], prompt, options, englishOnly: !local };
    }),
  };
}

export async function submitAnswer(input: SubmitAnswerInput): Promise<AnswerResult> {
  const { attemptId, questionId, answer, timeMs, try: tryNo } = input;
  // "" is a timeout, sent at the full 30 s (QUIZ.md §3).
  if (!["A", "B", "C", "D", ""].includes(answer) || (tryNo !== 1 && tryNo !== 2) ||
      !Number.isFinite(timeMs) || timeMs < 500 || timeMs > 30_000) {
    throw new Error("Invalid answer");
  }
  const { profile, summary, db } = await session();

  let q = DEMO_BANK.find((b) => b.id === questionId);
  let context: QuizContext = "practice";
  let history: FirstTry[] = [];
  let todayXp = 0;
  if (db) {
    const attempt = await loadAttempt(db, profile.id, attemptId, questionId);
    context = attempt.context;
    if (context === "placement" && profile.onboardedAt) throw new Error("Placement is only during onboarding");
    const [question, inAttempt, past, today] = await Promise.all([
      db.from("play_questions").select(BANK_COLUMNS).eq("id", questionId).single(),
      db.from("play_answers").select("question_id, try, correct, answered_at").eq("attempt_id", attemptId),
      db.from("play_answers").select("question_id, correct, answered_at").eq("user_id", profile.id)
        .eq("question_id", questionId).eq("try", 1).neq("attempt_id", attemptId).order("answered_at"),
      xpTowardDailyCap(db, profile.id), // duel XP counts too (SCORE.md §3)
    ]);
    q = must(question) as BankQuestion;
    const answered: { question_id: string; try: number; correct: boolean; answered_at: string }[] = must(inAttempt);
    history = must(past).map(toFirstTry);
    todayXp = today;
    // Timing bounds (IMPLEMENTATION.md §6): no longer than the time since the attempt
    // started or the previous answer, plus latency.
    const since = Math.max(Date.parse(attempt.created_at), ...answered.map((a) => Date.parse(a.answered_at)));
    if (timeMs > Date.now() - since + LATENCY_MS) throw new Error("Invalid timing");
    const first = answered.find((a) => a.question_id === questionId && a.try === 1);
    // A try-2 row is either the reattempt or "Show answer" (revealAnswer), which forfeits it.
    if (answered.some((a) => a.question_id === questionId && a.try === tryNo)) throw new Error("Answer already recorded");
    if (tryNo === 2 && (!first || first.correct || context === "placement")) throw new Error("No reattempt allowed");
  }
  if (!q) throw new Error("Unknown question");
  if (tryNo === 2 && summary.coins < 1) throw new Error("Not enough coins");

  const key = q.content[profile.language] ?? q.content.en!;
  const correct = answer === key.answer;
  const result = tryNo === 1
    ? scoreFirstTry({ context, tier: q.tier, rating: summary.rating, correct, timeMs, history, todayXp })
    : { xp: 0, coins: correct ? 0 : -1, ratingDelta: 0 }; // wager, refunded when right

  // The unique row claims this try first, so concurrent submits can't both be awarded. If
  // the award then fails (e.g. the wager is refused), the row is removed so a retry works.
  const row = { attempt_id: attemptId, question_id: q.id, try: tryNo };
  if (db) {
    const { error } = await db.from("play_answers").insert({
      ...row, user_id: profile.id, context, answer, correct,
      time_ms: Math.round(timeMs), xp: result.xp, coins: result.coins, rating_delta: result.ratingDelta,
    });
    if (error) throw new Error("Answer already recorded", { cause: error });
  }
  const pillar = q.pillar;
  try {
    if (tryNo === 1 && (result.xp || result.coins || result.ratingDelta)) {
      const kind = context === "practice" ? (correct ? "quiz_answer_correct" : "quiz_answer_wrong") : KIND[context];
      // Placement XP counts once per question however many placement attempts are opened.
      const ref = context === "placement" ? `placement:${q.id}` : `answer:${attemptId}:${q.id}:1`;
      await recordActivity({ source: SOURCE[context], kind, pillar, ...result, ref });
    }
    if (tryNo === 2) {
      await recordActivity({ source: "play", kind: "quiz_reattempt_wager", pillar, xp: 0, coins: -1, ref: `wager:${attemptId}:${q.id}` });
      if (correct) {
        await recordActivity({ source: "play", kind: "quiz_reattempt_refund", pillar, xp: 0, coins: 1, ref: `refund:${attemptId}:${q.id}` });
      }
    }
  } catch (err) {
    if (db) await db.from("play_answers").delete().match(row);
    throw err;
  }
  // A wrong first try keeps the answer back while a reattempt is possible (QUIZ.md §3):
  // the student either pays for the reattempt or calls revealAnswer.
  if (tryNo === 1 && !correct && context !== "placement") return { correct, ...result };
  return { correct, correctAnswer: key.answer, explanation: key.explanation, ...result };
}

// "Show answer" after a wrong first try (QUIZ.md §3). Records a revealed try-2 row (no
// coins, no XP), which forfeits the reattempt for that question.
export async function revealAnswer({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const { profile, db } = await session();
  let q = DEMO_BANK.find((b) => b.id === questionId);
  if (db) {
    const attempt = await loadAttempt(db, profile.id, attemptId, questionId);
    const [question, first] = await Promise.all([
      db.from("play_questions").select(BANK_COLUMNS).eq("id", questionId).single(),
      db.from("play_answers").select("id").eq("attempt_id", attemptId).eq("question_id", questionId).eq("try", 1).maybeSingle(),
    ]);
    q = must(question) as BankQuestion;
    if (!first.data) throw new Error("Answer the question first");
    // Ignored if the reattempt (or an earlier reveal) is already recorded.
    const { error } = await db.from("play_answers").upsert({
      attempt_id: attemptId, user_id: profile.id, question_id: questionId, context: attempt.context,
      try: 2, answer: "", correct: false, time_ms: 0, revealed: true,
    }, { onConflict: "attempt_id,question_id,try", ignoreDuplicates: true });
    if (error) throw new Error("Quiz data unavailable", { cause: error });
  }
  if (!q) throw new Error("Unknown question");
  const key = q.content[profile.language] ?? q.content.en!;
  return { correctAnswer: key.answer, explanation: key.explanation };
}

// The placement question now on the student's screen (QuizRunner calls this as it shows
// one). If they leave before answering, resuming counts it as a timeout (W3-P6).
export async function showQuestion({ attemptId, questionId }: { attemptId: string; questionId: string }) {
  const { profile, db } = await session();
  if (!db) return;
  const attempt = await loadAttempt(db, profile.id, attemptId, questionId);
  if (attempt.context !== "placement") return;
  must(await db.from("play_attempts").update({ shown_question: questionId }).eq("id", attemptId).select("id").single());
}

// The student's attempt, checked to have served this question.
async function loadAttempt(db: ReturnType<typeof createAdminClient>, userId: string, attemptId: string, questionId: string) {
  const attempt = must(await db.from("play_attempts").select("context, question_ids, created_at")
    .eq("id", attemptId).eq("user_id", userId).maybeSingle());
  if (!attempt.question_ids.includes(questionId)) throw new Error("Question not in this attempt");
  return attempt as { context: QuizContext; question_ids: string[]; created_at: string };
}

// Awards round(score × 0.3) XP on the first run of a simulation each IST day (SCORE.md §5).
async function awardSim(simId: string, pillar: Pillar, score: number): Promise<number> {
  const { profile, db } = await session();
  const ref = `sim:${simId}:${istDate()}`;
  // Later runs today still play, but earn nothing.
  const earned = db && must(await db.from("xp_events").select("id").eq("user_id", profile.id).eq("ref", ref).limit(1)).length > 0;
  const xp = earned ? 0 : Math.round(score * 0.3);
  // Recorded even at 0 XP, so only the day's first run counts.
  if (!earned) await recordActivity({ source: "play", kind: "sim_completed", pillar, xp, ref });
  return xp;
}

// Replays a simulation run from its choices (IMPLEMENTATION.md §6): the client never
// sends a score.
export async function finishSim(simId: string, choices: number[]) {
  const run = simId === SIM.id ? runSim(choices) : null;
  if (!run) throw new Error("Invalid simulation run");
  return { ...run, xp: await awardSim(SIM.id, "budget", run.score) };
}

export async function finishChoiceSim(simId: string, choices: number[]) {
  const run = runChoiceSim(simId, choices);
  if (!run || !isChoiceSim(simId)) throw new Error("Invalid simulation run");
  return { ...run, xp: await awardSim(simId, CHOICE_SIMS[simId].pillar, run.score) };
}


async function resumePlacement(
  db: ReturnType<typeof createAdminClient>,
  attempt: NonNullable<Awaited<ReturnType<typeof getPlacementAttempt>>>,
  userId: string,
  language: "en" | "te" | "hi",
  rating: number,
): Promise<{ attemptId: string; questions: QuizQuestion[] }> {
  let remaining = attempt.questionIds.filter(id => !attempt.answeredIds.includes(id));
  const left = attempt.shownQuestion;
  if (left && remaining.includes(left)) {
    await recordTimeout(db, attempt.attemptId, userId, left, rating);
    remaining = remaining.filter(id => id !== left);
  }
  if (!remaining.length) return { attemptId: attempt.attemptId, questions: [] };
  const rows = must(await db.from("play_questions").select(BANK_COLUMNS).in("id", remaining)) as BankQuestion[];
  return {
    attemptId: attempt.attemptId,
    questions: remaining.map(id => {
      const q = rows.find(row => row.id === id);
      if (!q) throw new Error("Placement question unavailable");
      const local = q.content[language];
      const { prompt, options } = local ?? q.content.en!;
      return { id: q.id, type: q.type, pillar: q.pillar, tag: q.tags[0], prompt, options, englishOnly: !local };
    }),
  };
}

// A placement question the student saw and left unanswered: a timeout (wrong, 30 s), scored
// like submitAnswer's. A concurrent real answer wins the unique row.
async function recordTimeout(db: ReturnType<typeof createAdminClient>, attemptId: string, userId: string, questionId: string, rating: number) {
  const q = must(await db.from("play_questions").select(BANK_COLUMNS).eq("id", questionId).single()) as BankQuestion;
  const result = scoreFirstTry({ context: "placement", tier: q.tier, rating, correct: false, timeMs: 30_000, history: [], todayXp: 0 });
  const row = { attempt_id: attemptId, question_id: q.id, try: 1 };
  const { error } = await db.from("play_answers").insert({
    ...row, user_id: userId, context: "placement", answer: "", correct: false, time_ms: 30_000,
    xp: result.xp, coins: result.coins, rating_delta: result.ratingDelta,
  });
  if (error?.code === "23505") return;
  if (error) throw new Error("Quiz data unavailable", { cause: error });
  try {
    if (result.ratingDelta) await recordActivity({ source: "play", kind: "placement", pillar: q.pillar, ...result, ref: `placement:${q.id}` });
  } catch (err) {
    await db.from("play_answers").delete().match(row);
    throw err;
  }
}

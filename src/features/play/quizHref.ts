import { PILLARS, type Pillar } from "@/shared/types";
import { QUIZ_COUNTS, type QuizContext } from "./types";

type QuizParams = {
  context: QuizContext;
  returnTo: string; // where "End quiz" goes
  pillar?: Pillar;
  reelIds?: string[];
  chapterSlug?: string;
};

// Link to the shared quiz screen (QUIZ.md §1). Other features open the quiz with this
// URL instead of importing QuizRunner.
export function quizHref(q: QuizParams): string {
  const params = new URLSearchParams({ context: q.context, returnTo: q.returnTo });
  if (q.pillar) params.set("pillar", q.pillar);
  if (q.reelIds?.length) params.set("reels", q.reelIds.join(","));
  if (q.chapterSlug) params.set("chapter", q.chapterSlug);
  return `/play/quiz?${params}`;
}

// The reverse, for /play/quiz. Query strings are user input: anything unexpected falls
// back to a safe default.
const SAFE_PATH = /^\/(?!\/)[\w\-/.?=&%,]*$/;

export function parseQuizParams(sp: Record<string, string | string[] | undefined>): QuizParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const context = one(sp.context) ?? "";
  const pillar = one(sp.pillar) as Pillar;
  const returnTo = one(sp.returnTo) ?? "";
  return {
    context: Object.hasOwn(QUIZ_COUNTS, context) ? (context as QuizContext) : "practice",
    // Same-site paths only: an allow-list, because browsers read a backslash as "/" and drop
    // tabs and newlines, so "/\evil.com" or "/<tab>/evil.com" would leave the site.
    returnTo: SAFE_PATH.test(returnTo) ? returnTo : "/play",
    pillar: PILLARS.includes(pillar) ? pillar : undefined,
    reelIds: one(sp.reels)?.split(",").filter(Boolean),
    chapterSlug: one(sp.chapter),
  };
}

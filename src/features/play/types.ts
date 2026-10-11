import type { Pillar, Tag } from "@/shared/types";

// Questions per quiz, set by the context (QUIZ.md §1). The server enforces these.
export const QUIZ_COUNTS = { practice: 10, reel: 3, chapter: 5, placement: 8 } as const;
export type QuizContext = keyof typeof QUIZ_COUNTS;

// What the phone gets: never the correct answer or explanation (IMPLEMENTATION.md §6).
export type QuizQuestion = {
  id: string;
  type: "mcq" | "true_false" | "number";
  pillar: Pillar;
  tag: Tag;
  prompt: string;
  options?: string[]; // mcq: four options, answered as "A"–"D"
  englishOnly?: boolean; // not in the student's language yet (QUESTIONS.md §4)
};

// The question count comes from the context (QUIZ_COUNTS), never from the caller.
export type PickQuestionsInput = {
  context: QuizContext;
  pillar?: Pillar;
  reelIds?: string[];
  chapterSlug?: string;
};

export type SubmitAnswerInput = {
  attemptId: string;
  questionId: string;
  answer: string; // "A"–"D", "true"/"false", or a number as text
  timeMs: number;
  try: 1 | 2; // 2 = the coin reattempt (QUIZ.md §3)
};

export type AnswerResult = {
  correct: boolean;
  // Left out after a wrong first try while a reattempt is possible: revealAnswer() gives them.
  correctAnswer?: string;
  explanation?: string;
  xp: number;
  coins: number;
  ratingDelta: number;
};

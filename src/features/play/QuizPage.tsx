// /play/quiz (QUIZ.md §1): picks the attempt's questions on the server and hands them,
// with the student's own coins, rating and XP, to the quiz screen.
import { redirect } from "next/navigation";
import { getLearnMoreLinks } from "@/features/learn/server";
import { getXpSummary } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { pickQuestions } from "./actions";
import { parseQuizParams } from "./quizHref";
import { QuizRunner } from "./QuizRunner";

export async function QuizPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  const { context, returnTo, pillar, reelIds, chapterSlug } = parseQuizParams(searchParams);
  if (context === "placement" && profile.onboardedAt) redirect("/dashboard");
  if (!profile.onboardedAt && context !== "placement") redirect("/onboarding");
  const [summary, { attemptId, questions }] = await Promise.all([
    getXpSummary(profile.id),
    pickQuestions({ context, pillar, reelIds, chapterSlug }),
  ]);
  if (context === "placement" && questions.length === 0) redirect("/onboarding");
  // Reel quizzes link a wrong answer to the best chapter on its topic (RECOMMENDATION.md §4).
  const learnMore = context === "reel" ? await getLearnMoreLinks([...new Set(questions.map((q) => q.tag))]) : {};
  return (
    <QuizRunner
      context={context}
      returnTo={context === "placement" ? "/onboarding" : returnTo}
      attemptId={attemptId}
      questions={questions}
      start={{ coins: summary.coins, rating: summary.rating, totalXp: summary.totalXp }}
      learnMore={learnMore}
    />
  );
}

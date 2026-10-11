import type { Language, Pillar } from "../../shared/types.ts";

export function validUsername(value: string): boolean {
  return /^[a-z0-9_]{3,24}$/.test(value);
}

export function parseProfilePreferences(form: FormData) {
  const language = form.get("language");
  const grade = form.get("grade");
  if (language !== "en" && language !== "te" && language !== "hi") return null;
  if (grade !== "11" && grade !== "12") return null;
  return { language: language as Language, grade: Number(grade) as 11 | 12 };
}

export function parseOnboarding(form: FormData) {
  const preferences = parseProfilePreferences(form);
  if (!preferences) return null;
  const answers: Record<string, string> = {};
  const pillarNeed = {} as Record<Pillar, number>;
  for (const pillar of ["budget", "save", "invest", "safety"] as const) {
    const answer = form.get(pillar);
    if (answer !== "new" && answer !== "learning" && answer !== "confident") return null;
    answers[pillar] = answer;
    pillarNeed[pillar] = answer === "new" ? 1 : answer === "learning" ? 0.6 : 0.2;
  }
  return { ...preferences, persona: { answers, pillarNeed } };
}

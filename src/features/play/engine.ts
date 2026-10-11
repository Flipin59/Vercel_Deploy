// Quiz engine logic (QUESTIONS.md §4–6, SCORE.md §3 and §8). Pure: actions.ts loads
// the data, calls these and saves the results.
import { TIER_RATING, expectedScore, getSkillTier, tierDiff } from "../../shared/rating.ts";
import { PILLARS, TIERS, type Language, type Pillar, type Tag, type Tier } from "../../shared/types.ts";
import type { QuizContext } from "./types.ts";

export type BankQuestion = {
  id: string;
  pillar: Pillar;
  tags: Tag[];
  tier: Tier;
  type: "mcq";
  reel_id?: string | null;
  chapter_slug?: string | null;
  answers_count?: number;
  content: Partial<Record<Language, { prompt: string; options: string[]; answer: string; explanation: string }>>;
};

// One of the student's earlier first tries, oldest first.
export type FirstTry = { questionId: string; correct: boolean; at: number };

export type PickInput = {
  bank: BankQuestion[]; // live questions only
  language: Language;
  rating: number;
  pillarXp: Record<Pillar, number>;
  history: FirstTry[];
  shown: Set<string>; // served in the last 24 hours
  pillar?: Pillar;
  reelIds?: string[];
  reelTags?: Tag[]; // those reels' tags (manifest), for the top-up
  completedReels?: string[]; // which of reelIds the student completed
  chapterSlug?: string;
  recentReels?: string[]; // reels watched in the last 7 days (Reels' getRecentReelIds)
  recentChapters?: string[]; // chapters read in the last 7 days (Learn's getRecentChapterSlugs)
  now?: number;
  random?: () => number;
};

const DAY_MS = 86_400_000;
const tierIndex = (t: Tier) => TIERS.indexOf(t);
const tierAt = (i: number) => TIERS[Math.max(0, Math.min(TIERS.length - 1, i))];
const byTier = (a: BankQuestion, b: BankQuestion) => tierIndex(a.tier) - tierIndex(b.tier);
const hasLanguage = (q: BankQuestion, language: Language) => Boolean(q.content[language] ?? q.content.en);

export function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function pick(context: QuizContext, input: PickInput): BankQuestion[] {
  if (context === "chapter") return pickChapter(input);
  if (context === "reel") return pickReel(input);
  if (context === "placement") return pickPlacement(input);
  return pickPractice(input);
}

// §4: 10 questions, slots for difficulty × pillar, up to 2 reviews, relaxing as needed.
export function pickPractice(input: PickInput): BankQuestion[] {
  const { bank, language, history, shown, now = Date.now(), random = Math.random } = input;
  const userTier = getSkillTier(input.rating);
  const u = tierIndex(userTier);
  const lowerHalf = input.rating < TIER_RATING[userTier];
  const tiers = [
    ...Array(lowerHalf ? 3 : 1).fill(tierAt(u - 1)),
    ...Array(6).fill(userTier),
    ...Array(lowerHalf ? 1 : 3).fill(tierAt(u + 1)),
  ] as Tier[];
  const weakest = shuffle([...PILLARS], random).sort((a, b) => input.pillarXp[a] - input.pillarXp[b])[0];
  const pillars = input.pillar
    ? (Array(10).fill(input.pillar) as Pillar[])
    : shuffle(PILLARS.flatMap((p) => Array(p === weakest ? 4 : 2).fill(p) as Pillar[]), random);
  const slots = tiers.map((tier, i) => ({ tier, pillar: pillars[i] }));

  const tries = new Map<string, FirstTry[]>();
  for (const h of history) tries.set(h.questionId, [...(tries.get(h.questionId) ?? []), h]);
  // Review: last first try was wrong, due 1, 3 then 7 days after the 1st, 2nd, 3rd+ miss.
  const review = bank
    .filter((q) => {
      const t = tries.get(q.id);
      const last = t?.at(-1);
      if (!t || !last || last.correct || shown.has(q.id) || !hasLanguage(q, language)) return false;
      if (input.pillar && q.pillar !== input.pillar) return false;
      const misses = t.filter((x) => !x.correct).length;
      return now - last.at >= [1, 3, 7][Math.min(misses, 3) - 1] * DAY_MS;
    })
    .slice(0, 2);
  // Each review replaces a same-tier slot.
  for (let i = 0; i < review.length; i++) slots.splice(slots.findIndex((s) => s.tier === userTier), 1);

  const byId = new Map(bank.map((q) => [q.id, q]));
  const recentTags = new Set(history.slice(-20).flatMap((h) => byId.get(h.questionId)?.tags ?? []));
  const correctRecently = new Set(history.filter((h) => h.correct && now - h.at < 30 * DAY_MS).map((h) => h.questionId));
  const calibrating = (q: BankQuestion) => (q.answers_count ?? 0) < 30;
  const chosen = [...review];
  const spreadOk = (q: BankQuestion) =>
    q.tags.every((t) => chosen.filter((c) => c.tags.includes(t)).length < (input.pillar ? 2 : 1));
  // Relaxation order: calibration cap, tiers ±2, pillar mix, English, recent corrects,
  // and last the tag spread, so a quiz still reaches its count when the bank allows.
  const fits = (q: BankQuestion, slot: (typeof slots)[number], relax: number) =>
    !chosen.includes(q) && !shown.has(q.id) && (relax >= 6 || spreadOk(q)) &&
    (relax >= 1 || !calibrating(q) || !chosen.some(calibrating)) &&
    (relax >= 2 ? Math.abs(tierIndex(q.tier) - u) <= 2 : q.tier === slot.tier) &&
    (relax >= 3 && !input.pillar ? true : q.pillar === slot.pillar) &&
    Boolean(q.content[language] ?? (relax >= 4 ? q.content.en : undefined)) &&
    (relax >= 5 || !correctRecently.has(q.id));
  const recentlyConsumed = (q: BankQuestion) =>
    Boolean((q.reel_id && input.recentReels?.includes(q.reel_id)) || (q.chapter_slug && input.recentChapters?.includes(q.chapter_slug)));
  const score = (q: BankQuestion) =>
    (recentlyConsumed(q) ? 3 : 0) + (q.tags.some((t) => recentTags.has(t)) ? 0 : 2) +
    ((q.answers_count ?? 0) < 100 ? 1 : 0) + random();

  for (const slot of slots) {
    for (let relax = 0; relax <= 6; relax++) {
      const best = bank
        .filter((q) => fits(q, slot, relax))
        .map((q) => ({ q, s: score(q) }))
        .sort((a, b) => b.s - a.s)[0];
      if (best) {
        chosen.push(best.q);
        break;
      }
    }
  }
  return chosen.sort(byTier);
}

// §6: 5 of the chapter's questions, unseen first, easiest first.
function pickChapter({ bank, language, history, shown, chapterSlug }: PickInput): BankQuestion[] {
  const seen = new Set([...history.map((h) => h.questionId), ...shown]);
  return bank
    .filter((q) => q.chapter_slug === chapterSlug && hasLanguage(q, language))
    .sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)) || byTier(a, b))
    .slice(0, 5)
    .sort(byTier);
}

// §6: 3 questions linked to those reels — completed reels first, then unseen, then easiest —
// topped up from questions sharing those reels' tags (from the manifest, so reels without
// linked questions still get a quiz).
function pickReel({ bank, language, history, shown, rating, reelIds = [], reelTags = [], completedReels = [], now = Date.now() }: PickInput): BankQuestion[] {
  const seen = new Set([...history.map((h) => h.questionId), ...shown]);
  const correctRecently = new Set(history.filter((h) => h.correct && now - h.at < 30 * DAY_MS).map((h) => h.questionId));
  const u = tierIndex(getSkillTier(rating));
  const usable = bank.filter((q) => hasLanguage(q, language));
  const linked = usable.filter((q) => q.reel_id && reelIds.includes(q.reel_id));
  const tags = new Set([...reelTags, ...linked.flatMap((q) => q.tags)]);
  const topUp = usable
    .filter((q) => !linked.includes(q) && !correctRecently.has(q.id) && q.tags.some((t) => tags.has(t)))
    .sort((a, b) => Math.abs(tierIndex(a.tier) - u) - Math.abs(tierIndex(b.tier) - u));
  const unseenFirst = (a: BankQuestion, b: BankQuestion) => Number(seen.has(a.id)) - Number(seen.has(b.id));
  const notCompleted = (q: BankQuestion) => Number(!completedReels.includes(q.reel_id!));
  return [...linked.sort((a, b) => notCompleted(a) - notCompleted(b) || unseenFirst(a, b) || byTier(a, b)), ...topUp.sort(unseenFirst)]
    .slice(0, 3)
    .sort(byTier);
}

// RATING.md §4: 3 Bronze, 3 Silver, 2 Gold. Only standalone questions: a new student hasn't
// watched any reel or read any chapter yet.
function pickPlacement({ bank, language, random = Math.random }: PickInput): BankQuestion[] {
  const some = (tier: Tier, n: number) =>
    shuffle(bank.filter((q) => q.tier === tier && !q.reel_id && !q.chapter_slug && hasLanguage(q, language)), random).slice(0, n);
  return [...some("bronze", 3), ...some("silver", 3), ...some("gold", 2)];
}

const BASE_XP = { practice: 10, reel: 5, chapter: 5 } as const;
const multiplier = (d: number) => (d >= 2 ? 2 : d === 1 ? 1.5 : d === 0 ? 1 : d === -1 ? 0.5 : 0.25);

// XP (SCORE.md §3), coins (QUIZ.md §6) and rating change (SCORE.md §8) for a first try.
// `history` is the student's earlier first tries at this question, oldest first.
export function scoreFirstTry(a: {
  context: QuizContext;
  tier: Tier;
  rating: number;
  correct: boolean;
  timeMs: number;
  history: FirstTry[];
  todayXp: number;
  now?: number;
}): { xp: number; coins: number; ratingDelta: number } {
  const now = a.now ?? Date.now();
  const repeat = a.history.some((h) => h.correct && now - h.at < 30 * DAY_MS);
  const review = !repeat && a.history.at(-1)?.correct === false;
  const k = a.context === "placement" ? 32 : 4;
  const expected = expectedScore(a.rating, TIER_RATING[a.tier]);
  const timeLeft = Math.max(0, 30 - a.timeMs / 1000);
  const ratingDelta = a.correct
    ? Math.round(k * (1 - expected) * (1 + (0.5 * timeLeft) / 30))
    : Math.round(-k * expected) || 0;
  // Repeats earn no XP and no coins; the rating still moves.
  if (!a.correct || repeat) return { xp: 0, coins: 0, ratingDelta };
  if (a.context === "placement") return { xp: 40, coins: 0, ratingDelta };
  let xp = Math.max(1, Math.round(BASE_XP[a.context] * multiplier(tierDiff(a.tier, getSkillTier(a.rating)))));
  if (review) xp = Math.max(1, Math.round(xp / 2));
  if (a.todayXp >= 300) xp = Math.max(1, Math.round(xp / 2)); // daily soft cap
  return { xp, coins: 3, ratingDelta };
}

// "Recommended for you" in the library (RECOMMENDATION.md §2 filter, §5 top 3).
// Pure and type-only imports, so `node --test` can load it; scoring is passed in
// (Play's scoreItem) rather than imported. It gets the filtered pool, because popularity
// is normalised "among the candidates" (RECOMMENDATION.md §3).
import type { ContentItem, RecUser } from "@/shared/types";

export type ChapterProgress = {
  slug: string;
  lastPage: number;
  updatedAt: string;
  finishedAt: string | null;
};

export function recommendChapters(
  items: ContentItem[], // already in the student's language, or English when theirs is missing
  user: RecUser,
  progress: ChapterProgress[],
  score: (item: ContentItem, candidates: ContentItem[]) => number,
  count = 3,
): { item: ContentItem; score: number }[] {
  const started = new Map(progress.map((p) => [p.slug, p]));
  const finished = (slug: string) => Boolean(started.get(slug)?.finishedAt);
  // Started chapters belong to "Continue reading"; finished ones are done.
  const eligible = items.filter((i) => !started.has(i.id) && (i.requires ?? []).every(finished));

  // Level window [L − 8, L + 4], widened by 5 a side up to 3 times while under 20 candidates.
  const within = (lo: number, hi: number) => eligible.filter((i) => i.level >= lo && i.level <= hi);
  let [lo, hi] = [user.level - 8, user.level + 4];
  let pool = within(lo, hi);
  for (let i = 0; i < 3 && pool.length < 20; i++) pool = within((lo -= 5), (hi += 5));

  const ranked = pool.map((item) => ({ item, score: score(item, pool) })).sort((a, b) => b.score - a.score);
  // Different pillars where possible, then fill up with the best of the rest.
  const picked: typeof ranked = [];
  for (const r of ranked) if (picked.length < count && !picked.some((p) => p.item.pillar === r.item.pillar)) picked.push(r);
  for (const r of ranked) if (picked.length < count && !picked.includes(r)) picked.push(r);
  return picked.sort((a, b) => b.score - a.score);
}

import { scoreItem } from "@/features/play";
import { Library, type LibraryChapter } from "./Library";
import { recommendChapters } from "./recommend";
import { getRecommendationInput } from "./server";

// /learn: loads chapters, the student's progress and stats, and asks Play's scoreItem
// for "Recommended for you" (RECOMMENDATION.md §8).
export async function LibraryPage() {
  const { progress, ready, user, items } = await getRecommendationInput();
  const mine = new Map(progress.map((p) => [p.slug, p]));
  const isFinished = (slug: string) => Boolean(mine.get(slug)?.finishedAt);

  const chapters: LibraryChapter[] = ready.map((c) => ({
    slug: c.slug,
    pillar: c.pillar,
    level: c.level,
    pages: c.pages,
    page: mine.get(c.slug)?.lastPage ?? null,
    finished: isFinished(c.slug),
    readFirst: c.requires.find((r) => !isFinished(r)) ?? null,
  }));
  const continueReading = progress
    .filter((p) => !p.finishedAt && ready.some((c) => c.slug === p.slug))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((p) => p.slug);
  const recommended = recommendChapters(items, user, progress, (i, candidates) => scoreItem(i, user, candidates)).map((r) => ({
    slug: r.item.id,
    score: r.score,
  }));

  return <Library chapters={chapters} continueReading={continueReading} recommended={recommended} />;
}

import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/shared/session";
import { CHAPTERS } from "./chapters";
import { Reader } from "./Reader";
import { CHAPTER_BONUS_XP, checkChapterAttempt, getMyProgress, getVariant, hasPdf } from "./server";

// /learn/<slug>: picks the student's language version and their last page, and settles
// the chapter check the student just came back from.
export async function ReaderPage({ slug, attemptId }: { slug: string; attemptId?: string }) {
  if (!CHAPTERS.some((c) => c.slug === slug)) notFound();
  const profile = await getCurrentProfile();
  const [{ language, pages }, progress, download] = await Promise.all([
    getVariant(slug, profile?.language ?? "en"),
    getMyProgress(),
    hasPdf(slug, profile?.language ?? "en"),
  ]);
  const check = attemptId ? await checkChapterAttempt(slug, attemptId) : null;
  const last = progress.find((p) => p.slug === slug)?.lastPage ?? 1;
  return (
    <Reader
      slug={slug}
      language={language}
      pages={pages}
      download={download}
      initialPage={Math.min(Math.max(last, 1), Math.max(pages, 1))}
      check={check && { ...check, bonusXp: CHAPTER_BONUS_XP }}
    />
  );
}

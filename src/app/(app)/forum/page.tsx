import { getCurrentProfile } from "@/shared/session";
import { getForumThreads } from "@/features/forum/server";
import { ForumView } from "@/features/forum/ForumView";
import { CHAPTERS, chapterTitle } from "@/features/learn";

export default async function Page({ searchParams }: PageProps<"/forum">) {
  const profile = await getCurrentProfile();
  const threads = await getForumThreads(profile?.id);
  // Learn's "Discuss this chapter" link: /forum?discuss=<slug> opens a prefilled new thread.
  const { discuss } = await searchParams;
  const chapter = CHAPTERS.find((c) => c.slug === discuss);
  const draft = chapter && { title: chapterTitle(chapter.slug, profile?.language ?? "en"), pillar: chapter.pillar, tags: chapter.tags };
  return <ForumView initialThreads={threads} draft={draft} />;
}

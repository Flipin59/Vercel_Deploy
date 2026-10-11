import { ReaderPage } from "@/features/learn/ReaderPage";

// `?attempt=<id>` is added by the quiz when a chapter check ends (L4 bonus).
export default async function Page({ params, searchParams }: PageProps<"/learn/[slug]">) {
  const [{ slug }, { attempt }] = await Promise.all([params, searchParams]);
  return <ReaderPage slug={slug} attemptId={typeof attempt === "string" ? attempt : undefined} />;
}

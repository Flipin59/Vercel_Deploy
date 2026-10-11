import { ReelsPage } from "@/features/reels/ReelsPage";

// `?r=<reelId>` (a shared link) starts the feed at that reel.
export default async function Page({ searchParams }: PageProps<"/reels">) {
  const { r } = await searchParams;
  return <ReelsPage startId={typeof r === "string" ? r : undefined} />;
}

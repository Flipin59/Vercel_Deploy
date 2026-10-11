// Server entry for /reels. Not exported from index.tsx, which must stay client-safe.
import { getCurrentProfile } from "@/shared/session";
import { ReelsFeed } from "./components/ReelsFeed";
import { loadReelsPage } from "./queries";

export async function ReelsPage({ startId }: { startId?: string }) {
  const profile = await getCurrentProfile();
  if (!profile) return null; // the (app) route guard sends signed-out users away first
  return <ReelsFeed data={await loadReelsPage(profile, startId)} />;
}

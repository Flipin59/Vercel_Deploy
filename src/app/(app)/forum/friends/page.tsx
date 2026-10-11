import { getFriendsPageData } from "@/features/forum/server";
import { FriendsPage } from "@/features/forum/FriendsPage";
import { getCurrentProfile } from "@/shared/session";

export default async function Page() {
  const profile = await getCurrentProfile();
  const data = profile
    ? await getFriendsPageData(profile.id)
    : { friends: [], pendingRequests: [], totalFriendsCount: 0 };

  return <FriendsPage initialData={data} />;
}

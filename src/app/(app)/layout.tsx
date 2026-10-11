import { getPendingRequestCount } from "@/features/forum/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/features/auth";
import { istDate } from "@/shared/progress/date";
import { recordActivity, getXpSummary } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { BottomNav } from "@/shared/ui/BottomNav";
import { Header } from "@/shared/ui/Header";

// Shell for every signed-in screen. Owned by platform.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // Proxy overwrites this header from the actual URL; supplied headers cannot bypass it.
  if (!profile.onboardedAt && (await headers()).get("x-lifeisgood-placement") !== "1") redirect("/onboarding");
  // Best-effort: a failed bonus must never take every page down with it.
  await recordActivity({
    source: "auth", kind: "daily_login", xp: 0, coins: 10,
    ref: `daily_login:${istDate()}`,
  }).catch((error) => console.error("[layout] daily login bonus", error));
  const [summary, pendingRequests] = await Promise.all([
    getXpSummary(profile.id).catch((error) => {
      console.error("[layout] progress summary", error);
      return null;
    }),
    getPendingRequestCount(profile.id).catch((error) => {
      console.error("[layout] pending requests", error);
      return 0;
    }),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Header
          title={summary?.title.label}
          streakDays={summary?.streakDays}
          coins={summary?.coins}
          pendingRequests={pendingRequests}
        />
      <main className="flex flex-1 flex-col pb-24">{children}<SignOutButton /></main>
      <BottomNav />
    </div>
  );
}

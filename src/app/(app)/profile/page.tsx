import { redirect } from "next/navigation";
import { getMyCohortName } from "@/features/auth/cohort";
import CohortJoin from "@/features/auth/CohortJoin";
import ProfileForm from "@/features/auth/ProfileForm";
import { getCurrentProfile } from "@/shared/session";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.onboardedAt) redirect("/onboarding");
  const { saved } = await searchParams;
  return (
    <>
      <ProfileForm key={`${profile.language}:${profile.grade}`} profile={profile} saved={saved === "1"} />
      <CohortJoin cohortName={await getMyCohortName()} teacher={profile.role === "teacher"} />
    </>
  );
}

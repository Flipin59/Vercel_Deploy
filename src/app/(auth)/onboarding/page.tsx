import { redirect } from "next/navigation";
import { getPlacementAttempt } from "@/features/play/server";
import Onboarding from "@/features/auth/Onboarding";
import { getCurrentProfile } from "@/shared/session";

export default async function Page() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.onboardedAt) redirect("/dashboard");
  const attempt = await getPlacementAttempt();
  return <Onboarding profile={profile} placement={attempt ? {
    answered: attempt.answeredIds.length, total: attempt.questionIds.length, correct: attempt.correct,
  } : null} />;
}

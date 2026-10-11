import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/shared/session";

export default async function Home() {
  const profile = await getCurrentProfile();
  redirect(!profile ? "/login" : profile.onboardedAt ? "/dashboard" : "/onboarding");
}

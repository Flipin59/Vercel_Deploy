import { redirect } from "next/navigation";
import AuthFeature from "@/features/auth";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";

export default async function Page({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const demo = !isSupabaseConfigured();
  const profile = await getCurrentProfile();
  if (!demo && profile) redirect(profile.onboardedAt ? "/dashboard" : "/onboarding");
  const params = await searchParams;
  return <AuthFeature demo={demo} verificationFailed={params.error === "verificationFailed"} />;
}

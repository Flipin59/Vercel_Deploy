import "server-only";
import { cache } from "react";
import type { Profile } from "./types";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";

export const DEMO_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000001",
  username: "demo_student", language: "en", grade: 11,
  onboardedAt: "2026-10-10T00:00:00Z", persona: {},
};

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  if (!isSupabaseConfigured()) return DEMO_PROFILE;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await supabase.from("profiles")
    .select("id, username, language, grade, onboarded_at, persona, role").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Unable to load the signed-in profile", { cause: error });
  if (!data) return null; // auth user without a profile row (e.g. created before the profile trigger)
  return {
    id: data.id, username: data.username, language: data.language,
    grade: data.grade, onboardedAt: data.onboarded_at, persona: data.persona, role: data.role,
  };
});

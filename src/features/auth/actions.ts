"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/shared/supabase/admin";
import { createClient } from "@/shared/supabase/server";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { getCurrentProfile } from "@/shared/session";
import { quizHref } from "@/features/play";
import { parseOnboarding, parseProfilePreferences, validUsername } from "./validation";

export type AuthState = { message?: string };

export async function authenticate(_previous: AuthState, form: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { message: "demoNotice" };
  const mode = form.get("mode");
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if ((mode !== "signin" && mode !== "signup") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !password || password.length > 128) {
    return { message: "invalidCredentials" };
  }
  const supabase = await createClient();
  if (mode === "signup") {
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    if (!validUsername(username) || password.length < 8) return { message: "invalidSignup" };
    // Set SITE_URL to a trusted deployment origin, never an incoming Host header.
    const origin = process.env.SITE_URL;
    if (!origin) return { message: "configurationError" };
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username }, emailRedirectTo: new URL("/auth/callback", origin).toString() },
    });
    if (error) return { message: "signupFailed" };
    if (!data.session) return { message: "checkEmail" };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { message: "signinFailed" };
  }
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut(): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { message: "demoNotice" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) return { message: "signoutFailed" };
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function completeOnboarding(_previous: AuthState, form: FormData): Promise<AuthState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isSupabaseConfigured()) return { message: "demoNotice" };
  if (profile.onboardedAt) redirect("/dashboard");
  const intent = form.get("intent");
  if (intent !== "placement" && intent !== "finish") return { message: "invalidOnboarding" };
  const values = parseOnboarding(form);
  if (!values) return { message: "invalidOnboarding" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({
    ...values, ...(intent === "finish" ? { onboarded_at: new Date().toISOString() } : {}),
  }).eq("id", profile.id).is("onboarded_at", null);
  if (error) return { message: "saveFailed" };
  revalidatePath("/", "layout");
  if (intent === "placement") redirect(quizHref({ context: "placement", returnTo: "/onboarding" }));
  redirect("/dashboard");
}


export async function updateProfile(_previous: AuthState, form: FormData): Promise<AuthState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.onboardedAt) redirect("/onboarding");
  if (!isSupabaseConfigured()) return { message: "demoNotice" };
  const values = parseProfilePreferences(form);
  if (!values) return { message: "invalidPreferences" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(values).eq("id", profile.id);
  if (error) return { message: "saveFailed" };
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}

const COHORT_CODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I

// A teacher (role set by an admin) creates a class and gets its join code.
export async function createCohort(_previous: AuthState, form: FormData): Promise<AuthState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher" || !isSupabaseConfigured()) return { message: "cohortNotAllowed" };
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 60) return { message: "cohortInvalidName" };
  const db = createAdminClient();
  for (let i = 0; i < 5; i++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => COHORT_CODE[n % COHORT_CODE.length]).join("");
    const { error } = await db.from("core_cohorts").insert({ teacher_id: profile.id, name, code });
    if (!error) {
      revalidatePath("/cohort");
      return {};
    }
    if (error.code !== "23505") break;
  }
  return { message: "saveFailed" };
}

// A student joins a teacher's class with its code (replacing any class they were in). The
// teacher then sees their username, level and XP.
export async function joinCohort(_previous: AuthState, form: FormData): Promise<AuthState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isSupabaseConfigured()) return { message: "demoNotice" };
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  if (code.length !== 6 || [...code].some((c) => !COHORT_CODE.includes(c))) return { message: "cohortInvalidCode" };
  const db = createAdminClient();
  const { data: cohort } = await db.from("core_cohorts").select("id, teacher_id").eq("code", code).maybeSingle();
  if (!cohort || cohort.teacher_id === profile.id) return { message: "cohortInvalidCode" };
  const { error } = await db.from("core_cohort_members").upsert({ user_id: profile.id, cohort_id: cohort.id, joined_at: new Date().toISOString() });
  if (error) return { message: "saveFailed" };
  revalidatePath("/profile");
  return {};
}

export async function leaveCohort(): Promise<AuthState> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!isSupabaseConfigured()) return { message: "demoNotice" };
  const { error } = await createAdminClient().from("core_cohort_members").delete().eq("user_id", profile.id);
  if (error) return { message: "saveFailed" };
  revalidatePath("/profile");
  return {};
}

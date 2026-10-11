// NGO / teacher cohorts (Wave 3b). Server-only: cohort tables have no RLS policies, so
// everything goes through the service role after checking the signed-in profile.
import "server-only";
import { getLevel, getTitle } from "@/shared/rating";
import { getCurrentProfile } from "@/shared/session";
import { createAdminClient } from "@/shared/supabase/admin";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import type { Pillar } from "@/shared/types";

// What a teacher sees of a member: username, title, level and XP. Nothing else (D13).
export type CohortMember = { username: string; title: string; level: number; weeklyXp: number; pillarXp: Record<Pillar, number> };
export type Cohort = { id: string; name: string; code: string; members: CohortMember[] };

// The signed-in teacher's cohorts with their members' progress. Null for anyone else.
export async function getTeacherCohorts(): Promise<Cohort[] | null> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "teacher" || !isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const [cohorts, progress] = await Promise.all([
    db.from("core_cohorts").select("id, name, code").eq("teacher_id", profile.id).order("created_at"),
    db.rpc("core_cohort_progress", { p_teacher: profile.id }),
  ]);
  if (cohorts.error || progress.error) throw new Error("Unable to load cohorts", { cause: cohorts.error ?? progress.error });
  type Row = { cohort_id: string; username: string; total_xp: number; weekly_xp: number; budget_xp: number; save_xp: number; invest_xp: number; safety_xp: number };
  return cohorts.data.map((c) => ({
    ...c,
    members: (progress.data as Row[]).filter((r) => r.cohort_id === c.id).map((r) => {
      const { level } = getLevel(Number(r.total_xp));
      return {
        username: r.username, title: getTitle(level).label, level, weeklyXp: Number(r.weekly_xp),
        pillarXp: { budget: Number(r.budget_xp), save: Number(r.save_xp), invest: Number(r.invest_xp), safety: Number(r.safety_xp) },
      };
    }).sort((a, b) => b.weeklyXp - a.weeklyXp || a.username.localeCompare(b.username)),
  }));
}

// The name of the cohort the signed-in student joined, or null.
export async function getMyCohortName(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile || !isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().from("core_cohort_members")
    .select("core_cohorts (name)").eq("user_id", profile.id).maybeSingle();
  if (error) {
    console.error("[auth] cohort", error.message);
    return null;
  }
  const cohort = data?.core_cohorts as { name: string } | { name: string }[] | null | undefined;
  return (Array.isArray(cohort) ? cohort[0]?.name : cohort?.name) ?? null;
}

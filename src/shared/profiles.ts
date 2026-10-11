// Other students as the app may show them (RATING.md §7): username and title for
// everyone, level only for friends. Server code only (IMPLEMENTATION.md §6).
import "server-only";
import { getLevel, getTitle } from "./rating";
import { getCurrentProfile } from "./session";
import { createAdminClient } from "./supabase/admin";
import { isSupabaseConfigured } from "./supabase/config";
import type { PublicProfile } from "./types";

type Row = { id: string; username: string; total_xp: number; role?: string };

function toPublic(row: Row, includeLevel: boolean): PublicProfile {
  const { level } = getLevel(Number(row.total_xp));
  return {
    id: row.id, username: row.username, title: getTitle(level).label, ...(includeLevel ? { level } : {}),
    ...(row.role === "teacher" || row.role === "mentor" ? { role: row.role } : {}),
  };
}

// Profiles for these ids, in no particular order. Pass includeLevel only for friends.
export async function getPublicProfiles(ids: string[], { includeLevel }: { includeLevel: boolean }): Promise<PublicProfile[]> {
  if (!(await getCurrentProfile())) throw new Error("Authentication required");
  if (!isSupabaseConfigured() || ids.length === 0) return [];
  const { data, error } = await createAdminClient().rpc("core_public_profiles", { p_ids: [...new Set(ids)] });
  if (error) throw new Error("Unable to load profiles", { cause: error });
  return (data as Row[]).map((r) => toPublic(r, includeLevel));
}

// Usernames containing `query` (case-insensitive, literal), best matches first. No levels.
export async function searchPublicProfiles(query: string, limit = 5): Promise<PublicProfile[]> {
  if (!(await getCurrentProfile())) throw new Error("Authentication required");
  const q = query.trim();
  if (!isSupabaseConfigured() || q.length < 2) return [];
  const { data, error } = await createAdminClient().rpc("core_search_profiles", { p_query: q.slice(0, 30), p_limit: limit });
  if (error) throw new Error("Unable to search profiles", { cause: error });
  return (data as Row[]).map((r) => toPublic(r, false));
}

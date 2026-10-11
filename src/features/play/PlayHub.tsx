// /play (IMPLEMENTATION.md P8): duel invites, duel entry, practice quiz, simulations.
import { redirect } from "next/navigation";
import { getFriends } from "@/features/forum/server";
import { getCurrentProfile } from "@/shared/session";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import { database, settleMyDuels } from "./duelStore";
import { PlayHubView } from "./PlayHubView";

export async function PlayHub() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // Duels the student left or never claimed count now (W3-P1); a failure mustn't hide the hub.
  await settleMyDuels(database(), profile.id).catch((error) => console.error("[play] settle duels", error));
  // getFriends throws on a read error; the hub still works without the friends list.
  const friends = await getFriends(profile.id).catch((error) => {
    console.error("[play] friends", error);
    return [];
  });
  return <PlayHubView friends={friends} userId={profile.id} realtime={isSupabaseConfigured()} />;
}

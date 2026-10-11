// /play/duel/<id>: the duel's first state plus what stays fixed (names, the student's
// own rating), handed to the arena, which then polls for the rest.
import { notFound } from "next/navigation";
import { getPublicProfiles } from "@/shared/profiles";
import { BOT } from "./duel";
import { DuelArena } from "./DuelArena";
import { getDuelView, loadDuel, sideOf } from "./duelStore";

export async function DuelPage({ id }: { id: string }) {
  const d = await loadDuel(id);
  const view = d && (await getDuelView(id));
  if (!d || !view) notFound();
  const [opponent] = d.opponent === BOT ? [null] : await getPublicProfiles([d.opponent], { includeLevel: false });
  return <DuelArena key={id} id={id} initial={view} rating={sideOf(d.row, d.profile.id).rating} opponent={opponent ?? null} />;
}

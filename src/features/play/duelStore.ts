// Duel storage and the per-player view (IMPLEMENTATION.md P7 and §6). Server-only: it
// holds the answer keys and the bot's rolls. Without Supabase (local demo) duels live
// in memory and only bot duels can be played.
import "server-only";
import { recordActivityFor } from "@/shared/progress";
import { istDate } from "@/shared/progress/date";
import { getCurrentProfile } from "@/shared/session";
import { createAdminClient } from "@/shared/supabase/admin";
import { isSupabaseConfigured } from "@/shared/supabase/config";
import type { Language, Pillar } from "@/shared/types";
import { BANK_COLUMNS, DEMO_BANK } from "./bank";
import { BOT, BOT_DAILY_CAP, INVITE_MS, LEAD_MS, PAIR_DAILY_CAP, REMATCH_MS, ROUNDS, duelOutcome, duelReward, duelRounds, leaveOutcome, pickDuel, whoLeft, type BotRoll } from "./duel";
import type { BankQuestion } from "./engine";

export type DuelRow = {
  id: string;
  mode: "bot" | "quick" | "friend" | "code";
  player_a: string;
  player_b: string | null;
  status: "invited" | "active" | "done" | "cancelled" | "declined" | "expired";
  question_ids: string[];
  bot: BotRoll[] | null;
  rating_a: number;
  rating_b: number | null;
  lang_a: Language;
  lang_b: Language | null;
  started_at: string | null;
  seen_a: string | null;
  seen_b: string | null;
  forfeit: string | null;
  react_a?: Reaction | null;
  react_b?: Reaction | null;
  rematch_a?: RematchTap | null;
  rematch_b?: RematchTap | null;
  rematch_id?: string | null;
  created_at: string;
};
type Reaction = { r: string; at: string };
export type RematchTap = { at: string; rating: number; language: Language };
type AnswerRow = { duel_id: string; round: number; user_id: string; question_id: string; answer: string; correct: boolean; answered_at: string };
export type Db = ReturnType<typeof createAdminClient>;

const memory = { duels: new Map<string, DuelRow>(), answers: [] as AnswerRow[] };
const DAY_MS = 86_400_000;

export function database(): Db | null {
  return isSupabaseConfigured() ? createAdminClient() : null;
}

export function must<T>({ data, error }: { data: T; error: unknown }): NonNullable<T> {
  if (error || data == null) throw new Error("Duel data unavailable", { cause: error });
  return data as NonNullable<T>;
}

async function getRow(db: Db | null, id: string): Promise<DuelRow | null> {
  if (!db) return memory.duels.get(id) ?? null;
  return (await db.from("play_duels").select("*").eq("id", id).maybeSingle()).data;
}

// Applies `patch` only while the duel is still in `status`; false if someone else moved it on.
export async function patchDuel(db: Db | null, row: DuelRow, status: DuelRow["status"], patch: Partial<DuelRow>) {
  if (!db) {
    if (row.status !== status) return false;
    memory.duels.set(row.id, Object.assign(row, patch));
    return true;
  }
  const { data } = await db.from("play_duels").update(patch).eq("id", row.id).eq("status", status).select("id");
  if (!data?.length) return false; // lost the race: the caller reloads rather than trusting the patch
  Object.assign(row, patch);
  return true;
}

export async function insertDuel(db: Db | null, row: Pick<DuelRow, "id" | "mode" | "player_a" | "player_b" | "status" | "question_ids" | "bot" | "rating_a" | "rating_b" | "lang_a" | "lang_b" | "started_at">) {
  const now = new Date().toISOString();
  // The opponent hasn't opened it yet: their first poll sets seen_b (see leave()).
  const full: DuelRow = { ...row, created_at: now, seen_a: now, seen_b: null, forfeit: null };
  if (db) must(await db.from("play_duels").insert(full).select("id").single());
  else memory.duels.set(full.id, full);
  return full.id;
}

async function getAnswers(db: Db | null, id: string): Promise<AnswerRow[]> {
  if (!db) return memory.answers.filter((a) => a.duel_id === id);
  return must(await db.from("play_duel_answers").select("*").eq("duel_id", id));
}

// False when the row conflicts: already answered this round, or someone was right first.
export async function insertAnswer(db: Db | null, row: AnswerRow): Promise<boolean> {
  if (!db) {
    const taken = memory.answers.some((a) => a.duel_id === row.duel_id && a.round === row.round &&
      (a.user_id === row.user_id || (a.correct && row.correct)));
    if (!taken) memory.answers.push(row);
    return !taken;
  }
  const { error } = await db.from("play_duel_answers").insert(row);
  if (error?.code === "23505") return false;
  if (error) throw new Error("Duel data unavailable", { cause: error });
  return true;
}

export async function loadBank(db: Db | null, ids?: string[]): Promise<BankQuestion[]> {
  if (!db) return ids ? ids.map((id) => DEMO_BANK.find((q) => q.id === id)!) : DEMO_BANK;
  const query = db.from("play_questions").select(BANK_COLUMNS);
  const rows = must(await (ids ? query.in("id", ids) : query.eq("status", "live"))) as BankQuestion[];
  return ids ? ids.map((id) => rows.find((q) => q.id === id)!) : rows;
}

// Five questions for these players, skipping what either answered in the last 30 days.
export async function duelQuestions(db: Db | null, players: { id: string; rating: number; language: Language }[], pillar?: Pillar) {
  const answered = new Set<string>();
  if (db) {
    const ids = players.map((p) => p.id);
    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const [quiz, duel] = await Promise.all([
      db.from("play_answers").select("question_id").in("user_id", ids).eq("try", 1).gte("answered_at", since),
      db.from("play_duel_answers").select("question_id").in("user_id", ids).gte("answered_at", since),
    ]);
    for (const r of [...must(quiz), ...must(duel)]) answered.add(r.question_id);
  }
  const picked = pickDuel({
    bank: await loadBank(db), ratings: players.map((p) => p.rating), languages: players.map((p) => p.language), answered, pillar,
  });
  if (picked.length < ROUNDS) throw new Error("Not enough live questions for a duel");
  return picked;
}

// Ends the student's own running duels, invites and quick-match search before a new one
// starts: a student is in one duel at a time, and leaving loses (RECOMMENDATION.md §6,
// SCORE.md §4). Then credits every finished duel they haven't been credited for.
export async function leaveOtherDuels(db: Db | null, userId: string, except?: string) {
  if (db) {
    await db.from("play_queue").delete().eq("user_id", userId);
    await db.from("play_codes").delete().eq("user_id", userId).is("duel_id", null);
  }
  const mine = db
    ? must(await db.from("play_duels").select("*").in("status", ["active", "invited"]).or(`player_a.eq.${userId},player_b.eq.${userId}`)) as DuelRow[]
    : [...memory.duels.values()].filter((d) => ["active", "invited"].includes(d.status) && (d.player_a === userId || d.player_b === userId));
  for (const row of mine.filter((r) => r.id !== except)) {
    if (row.status === "invited") await patchDuel(db, row, "invited", { status: "expired" });
    else await leave(db, row, roundsOf(row, await getAnswers(db, row.id), Date.now()), userId);
  }
  // A duel that can't be settled must never block starting a new one.
  await settleMyDuels(db, userId, except).catch((error) => console.error("[play] settle duels", error));
}

const roundsOf = (row: DuelRow, answers: AnswerRow[], now: number) =>
  row.started_at ? duelRounds(Date.parse(row.started_at), answers.map(toAnswer), row.bot, now) : { rounds: [], done: false };

// `leaver` left the active duel (duel.ts leaveOutcome). "Opened" = polled it after it started.
async function leave(db: Db | null, row: DuelRow, state: ReturnType<typeof roundsOf>, leaver: string) {
  const seen = leaver === row.player_a ? row.seen_a : row.seen_b;
  const opened = Boolean(seen && row.started_at && Date.parse(seen) >= Date.parse(row.started_at));
  const how = leaveOutcome(state, opened);
  return patchDuel(db, row, "active", how === "forfeit" ? { status: "done", forfeit: leaver } : { status: how });
}

// The duel as the signed-in player sees it, after bringing it up to date: invites
// expire, a player who stopped polling has left, and five played rounds finish it.
// `touch: false` (settling, cancelling from elsewhere) doesn't count as the player being
// at the duel: no seen update and no absence check, only finishing by time.
export async function loadDuel(id: string, { touch = true } = {}) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Authentication required");
  const db = database();
  const row = await getRow(db, id);
  if (!row || (row.player_a !== profile.id && row.player_b !== profile.id)) return null;
  const now = Date.now();
  const side = row.player_a === profile.id ? "a" : "b";
  const opponent = (side === "a" ? row.player_b : row.player_a) ?? BOT;
  const answers = row.status === "invited" ? [] : await getAnswers(db, id);

  if (row.status === "invited" && now - Date.parse(row.created_at) > INVITE_MS) {
    await patchDuel(db, row, "invited", { status: "expired" });
  }
  let state = roundsOf(row, answers, now);
  if (row.status === "active") {
    const seenKey = side === "a" ? "seen_a" : "seen_b";
    const mySeen = row[seenKey];
    const myLast = Math.max(Date.parse(mySeen ?? row.created_at), Date.parse(row.started_at ?? row.created_at));
    if (touch && (!mySeen || now - Date.parse(mySeen) > 5_000)) {
      const seen = new Date(now).toISOString();
      if (db) await db.from("play_duels").update({ [seenKey]: seen }).eq("id", id);
      row[seenKey] = seen;
    }
    const theirSeen = side === "a" ? row.seen_b : row.seen_a;
    let moved = true;
    // Absence counts from the start at the earliest: an invite's challenger last polled before it.
    const lastThere = Math.max(Date.parse(theirSeen ?? row.created_at), Date.parse(row.started_at ?? row.created_at));
    const left = touch && opponent !== BOT && !state.done ? whoLeft(now, myLast, lastThere) : null;
    if (left) {
      moved = await leave(db, row, state, left === "me" ? profile.id : opponent);
    } else if (state.done) {
      moved = await patchDuel(db, row, "active", { status: "done" });
    }
    if (!moved) Object.assign(row, await getRow(db, id)); // lost a race: take what the other poll wrote
    if (row.status !== "active") state = { ...state, done: true };
  }
  return { db, profile, row, side, opponent, answers, state, now };
}
type LoadedDuel = NonNullable<Awaited<ReturnType<typeof loadDuel>>>;

// Quiz and duel XP the student earned today (IST), for the 300 XP daily soft cap (SCORE.md §3).
export async function xpTowardDailyCap(db: Db | null, userId: string): Promise<number> {
  if (!db) return 0;
  const since = `${istDate()}T00:00:00+05:30`;
  const [quiz, duels] = await Promise.all([
    db.from("play_answers").select("xp").eq("user_id", userId).gte("answered_at", since),
    db.from("xp_events").select("xp").eq("user_id", userId).like("ref", "duel:%").gte("created_at", since),
  ]);
  return [...must(quiz), ...must(duels)].reduce((n: number, r: { xp: number }) => n + r.xp, 0);
}

// One player's XP and rating change for a finished duel, recorded once (ref duel:<id>,
// even at 0 so it isn't looked at again). A repeat returns what was recorded.
async function recordDuel(d: LoadedDuel, player: string) {
  const { db, row, state } = d;
  const opponent = player === row.player_a ? (row.player_b ?? BOT) : row.player_a;
  const { result, roundsWon } = duelOutcome(state.rounds, player, opponent, row.forfeit);
  const ref = `duel:${row.id}`;
  if (db) {
    const earlier = (await db.from("xp_events").select("xp, rating_delta").eq("user_id", player).eq("ref", ref).maybeSingle()).data;
    if (earlier) return { result, xp: earlier.xp as number, ratingDelta: earlier.rating_delta as number };
  }
  let capped = false;
  if (db) {
    // Only the first 3 finished duels per pair, and the first 5 bot duels per student, per
    // IST day count (SCORE.md §4).
    const day = `${istDate(new Date(row.created_at))}T00:00:00+05:30`;
    const earlier = db.from("play_duels").select("id", { count: "exact", head: true })
      .eq("status", "done").gte("created_at", day).lt("created_at", row.created_at);
    const { count } = row.mode === "bot"
      ? await earlier.eq("mode", "bot").eq("player_a", player)
      : await earlier.neq("mode", "bot")
        .or(`and(player_a.eq.${row.player_a},player_b.eq.${row.player_b}),and(player_a.eq.${row.player_b},player_b.eq.${row.player_a})`);
    capped = (count ?? 0) >= (row.mode === "bot" ? BOT_DAILY_CAP : PAIR_DAILY_CAP);
  }
  const overDailyCap = (await xpTowardDailyCap(db, player)) >= 300;
  const reward = duelReward({ result, roundsWon, ...sideOf(row, player), bot: opponent === BOT, capped, overDailyCap });
  const [first] = await loadBank(db, [row.question_ids[0]]);
  const kind = result === 1 ? "duel_won" : result === 0.5 ? "duel_draw" : "duel_lost";
  await recordActivityFor(player, { source: "play", kind, pillar: first.pillar, ...reward, ref });
  return { result, ...reward };
}

// Both players' results once the duel is done (W3-P1, W3-S4), so a player who left gets
// their loss when the other phone claims. Returns the signed-in player's.
export async function settleDuel(d: LoadedDuel) {
  const [mine, theirs] = d.profile.id === d.row.player_a ? [d.row.player_a, d.row.player_b] : [d.row.player_b!, d.row.player_a];
  const reward = await recordDuel(d, mine);
  if (theirs) await recordDuel(d, theirs);
  return reward;
}

// Fallback for duels no phone claimed (both players left, or a claim failed): credits the
// signed-in student's finished duels from the last 30 days when they open Play or start a
// duel. Running duels are brought up to date first (e.g. a bot duel that played out).
export async function settleMyDuels(db: Db | null, userId: string, except?: string) {
  if (!db) return;
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const rows = must(await db.from("play_duels").select("id").in("status", ["active", "done"]).gte("created_at", since)
    .or(`player_a.eq.${userId},player_b.eq.${userId}`)) as { id: string }[];
  const open = rows.filter((r) => r.id !== except);
  if (!open.length) return;
  const refs = must(await db.from("xp_events").select("ref").eq("user_id", userId).in("ref", open.map((r) => `duel:${r.id}`)));
  const credited = new Set(refs.map((r: { ref: string }) => r.ref));
  for (const r of open.filter((r) => !credited.has(`duel:${r.id}`))) {
    try {
      const d = await loadDuel(r.id, { touch: false });
      if (d?.row.status === "done" && d.row.question_ids.length) await settleDuel(d);
    } catch (error) {
      console.error("[play] settle duel", r.id, error);
    }
  }
}

const toAnswer = (a: AnswerRow) => ({ round: a.round, who: a.user_id, correct: a.correct, at: Date.parse(a.answered_at) });

export type DuelView = {
  status: DuelRow["status"];
  mode: DuelRow["mode"];
  now: number; // server clock, so the phone can correct its own
  inviteExpiresAt: number;
  invitee: boolean; // an open invite to this player: show Accept / Decline
  rounds: {
    revealAt: number;
    endAt: number | null;
    question: { prompt: string; options: string[] } | null; // from LEAD_MS before the reveal
    myAnswer: string | null;
    opponentFrozen: boolean;
    winner: "me" | "opponent" | null;
    points: number;
    correctAnswer: string | null; // once the round is over
  }[];
  score: { me: number; opponent: number };
  result: { outcome: 1 | 0.5 | 0; forfeit: "me" | "opponent" | null } | null;
  // Each player's latest preset reaction and when (server clock).
  reactions: { me: { r: string; at: number } | null; opponent: { r: string; at: number } | null };
  // Open rematch offers (until = server clock) and the new duel once both tapped.
  rematch: { mineUntil: number | null; theirsUntil: number | null; duelId: string | null };
};

export async function getDuelView(id: string): Promise<DuelView | null> {
  const d = await loadDuel(id);
  if (!d) return null;
  const { db, profile, row, side, opponent, answers, state, now } = d;
  const questions = row.question_ids.length ? await loadBank(db, row.question_ids) : [];
  const who = (p: string | null) => (p === profile.id ? "me" : p ? "opponent" : null);
  const outcome = duelOutcome(state.rounds, profile.id, opponent, row.forfeit);
  const [mine, theirs] = side === "a" ? (["a", "b"] as const) : (["b", "a"] as const);
  const reaction = (r?: Reaction | null) => (r ? { r: r.r, at: Date.parse(r.at) } : null);
  const offerUntil = (tap?: RematchTap | null) => (tap && Date.parse(tap.at) + REMATCH_MS > now ? Date.parse(tap.at) + REMATCH_MS : null);
  return {
    status: row.status,
    mode: row.mode,
    now,
    inviteExpiresAt: Date.parse(row.created_at) + INVITE_MS,
    invitee: row.status === "invited" && side === "b",
    rounds: state.rounds.map((r, i) => {
      const key = questions[i].content[profile.language] ?? questions[i].content.en!;
      return {
        revealAt: r.revealAt,
        endAt: r.endAt,
        question: now >= r.revealAt - LEAD_MS ? { prompt: key.prompt, options: key.options } : null,
        myAnswer: answers.find((a) => a.round === r.round && a.user_id === profile.id)?.answer ?? null,
        opponentFrozen: r.frozen.includes(opponent),
        winner: who(r.winner),
        points: r.points,
        correctAnswer: r.endAt !== null ? key.answer : null,
      };
    }),
    score: { me: outcome.score, opponent: outcome.opponentScore },
    result: row.status === "done" ? { outcome: outcome.result, forfeit: who(row.forfeit) as "me" | "opponent" | null } : null,
    reactions: { me: reaction(row[`react_${mine}`]), opponent: reaction(row[`react_${theirs}`]) },
    rematch: {
      mineUntil: offerUntil(row[`rematch_${mine}`]),
      theirsUntil: offerUntil(row[`rematch_${theirs}`]),
      // Only once the new duel's row exists, so the phone never opens a missing duel.
      duelId: row.rematch_id && (await getRow(db, row.rematch_id)) ? row.rematch_id : null,
    },
  };
}

// The player's and the opponent's skill ratings when the duel started (the bot's = the player's).
export function sideOf(row: DuelRow, player: string) {
  return row.player_a === player
    ? { rating: row.rating_a, opponentRating: row.rating_b ?? row.rating_a }
    : { rating: row.rating_b ?? row.rating_a, opponentRating: row.rating_a };
}

"use server";

// Duel server actions (IMPLEMENTATION.md P7). Every export is a public endpoint: the
// player comes from the session, and rounds, winners and rewards are worked out from
// what the server stored (IMPLEMENTATION.md §6). Phones follow a duel by polling
// /play/duel/<id>/state (getDuelView).
import { getFriends } from "@/features/forum/server";
import { getPublicProfiles } from "@/shared/profiles";
import { getLevel } from "@/shared/rating";
import { getXpSummary } from "@/shared/progress";
import { getCurrentProfile } from "@/shared/session";
import { BOT, CODE_ALPHABET, CODE_MS, INVITE_MS, REACTIONS, REMATCH_MS, rollBot } from "./duel";
import {
  database, duelQuestions, insertAnswer, insertDuel, leaveOtherDuels, loadBank, loadDuel, must, patchDuel, settleDuel,
  type RematchTap,
} from "./duelStore";

const LETTERS = ["A", "B", "C", "D"];
const QUEUE_FRESH_MS = 6_000; // play_find_match only matches rows polled this recently
const MATCH_LOAD_MS = 3_000; // extra lead so the matched player's phone loads before round 1

async function player() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Authentication required");
  const { rating } = await getXpSummary(profile.id);
  return { profile, rating, db: database() };
}

// Paisa Bot at the student's own rating; always available (RECOMMENDATION.md §6).
export async function startBotDuel(): Promise<string> {
  const { profile, rating, db } = await player();
  await leaveOtherDuels(db, profile.id);
  const questions = await duelQuestions(db, [{ id: profile.id, rating, language: profile.language }]);
  return insertDuel(db, {
    id: crypto.randomUUID(), mode: "bot", player_a: profile.id, player_b: null, status: "active",
    question_ids: questions.map((q) => q.id), bot: rollBot(questions, rating),
    rating_a: rating, rating_b: null, lang_a: profile.language, lang_b: null, started_at: new Date().toISOString(),
  });
}

// Polled every 2 s by the waiting screen: joins the queue, then returns the duel once
// matched. The caller who finds the match creates the duel.
export async function findMatch(): Promise<{ duelId: string | null }> {
  const { profile, rating, db } = await player();
  if (!db) return { duelId: null }; // the demo has no one else to play
  let queued = (await db.from("play_queue").select("duel_id, seen_at").eq("user_id", profile.id).maybeSingle()).data;
  const stale = queued && Date.now() - Date.parse(queued.seen_at) > QUEUE_FRESH_MS;
  if (queued?.duel_id) {
    // Matched: the other player creates the duel. A slow poll still finds it.
    const exists = (await db.from("play_duels").select("id").eq("id", queued.duel_id).maybeSingle()).data;
    if (exists) {
      await db.from("play_queue").delete().eq("user_id", profile.id);
      return { duelId: queued.duel_id };
    }
    // ponytail: a creator that died mid-insert leaves both rows waiting until one stops polling.
    if (!stale) {
      await db.from("play_queue").update({ seen_at: new Date().toISOString() }).eq("user_id", profile.id);
      return { duelId: null };
    }
  }
  if (stale) {
    // Left over from an earlier search (closed tab): start over with today's rating and wait time.
    await db.from("play_queue").delete().eq("user_id", profile.id);
    queued = null;
  }
  if (!queued) {
    await leaveOtherDuels(db, profile.id);
    must(await db.from("play_queue").insert({ user_id: profile.id, rating, language: profile.language }).select("user_id").single());
  } else {
    await db.from("play_queue").update({ seen_at: new Date().toISOString() }).eq("user_id", profile.id);
  }
  const match = must(await db.rpc("play_find_match", { p_user: profile.id })) as { duel_id: string; opponent: string }[];
  if (!match.length) return { duelId: null };
  const { duel_id, opponent } = match[0];
  try {
    const them = must(await db.from("play_queue").select("rating, language").eq("user_id", opponent).single());
    const questions = await duelQuestions(db, [
      { id: profile.id, rating, language: profile.language },
      { id: opponent, rating: them.rating, language: them.language },
    ]);
    await insertDuel(db, {
      id: duel_id, mode: "quick", player_a: profile.id, player_b: opponent, status: "active",
      question_ids: questions.map((q) => q.id), bot: null, rating_a: rating, rating_b: them.rating,
      lang_a: profile.language, lang_b: them.language, started_at: new Date(Date.now() + MATCH_LOAD_MS).toISOString(),
    });
  } catch (error) {
    // Unmatch both rows, or they'd wait forever for a duel that doesn't exist.
    await db.from("play_queue").update({ duel_id: null }).eq("duel_id", duel_id);
    throw error;
  }
  await db.from("play_queue").delete().eq("user_id", profile.id);
  return { duelId: duel_id };
}

export async function leaveQueue() {
  const { profile, db } = await player();
  if (db) await db.from("play_queue").delete().eq("user_id", profile.id).is("duel_id", null);
}

async function blocked(db: ReturnType<typeof database>, a: string, b: string) {
  if (!db) return false;
  const rows = must(await db.from("play_blocks").select("user_id")
    .or(`and(user_id.eq.${a},blocked_id.eq.${b}),and(user_id.eq.${b},blocked_id.eq.${a})`));
  return rows.length > 0;
}

// Invites a friend; they see it on their Play hub for 60 s. Questions are picked when
// they accept, once both players' ratings and languages are known.
export async function challengeFriend(friendId: string): Promise<string> {
  const { profile, rating, db } = await player();
  const friends = await getFriends(profile.id);
  if (!friends.some((f) => f.id === friendId) || (await blocked(db, profile.id, friendId))) {
    throw new Error("You can only challenge your friends");
  }
  await leaveOtherDuels(db, profile.id);
  return insertDuel(db, {
    id: crypto.randomUUID(), mode: "friend", player_a: profile.id, player_b: friendId, status: "invited",
    question_ids: [], bot: null, rating_a: rating, rating_b: null, lang_a: profile.language, lang_b: null, started_at: null,
  });
}

// Open invites to the signed-in student, with the challenger's username, title and level.
export async function getInvites(): Promise<{ id: string; username: string; title: string; level?: number; expiresAt: number }[]> {
  const { profile, db } = await player();
  if (!db) return [];
  const rows = must(await db.from("play_duels").select("id, player_a, created_at").eq("player_b", profile.id)
    .eq("status", "invited").gte("created_at", new Date(Date.now() - INVITE_MS).toISOString()));
  const people = await getPublicProfiles(rows.map((r) => r.player_a), { includeLevel: true });
  return rows.flatMap((r) => {
    const p = people.find((x) => x.id === r.player_a);
    return p ? [{ id: r.id, username: p.username, title: p.title, level: p.level, expiresAt: Date.parse(r.created_at) + INVITE_MS }] : [];
  });
}

// The challenger takes back an invite (leaving the waiting screen): otherwise a friend
// accepting later would start a duel the challenger isn't at.
export async function cancelInvite(duelId: string) {
  const d = await loadDuel(duelId, { touch: false });
  if (d?.side !== "a") return;
  // Accepted a moment ago: leaving before opening it cancels it (SCORE.md §4).
  if (d.row.status === "invited" || d.row.status === "active") await leaveOtherDuels(d.db, d.profile.id);
}

export async function respondInvite(duelId: string, accept: boolean) {
  const { profile, rating } = await player();
  const d = await loadDuel(duelId);
  if (!d || d.side !== "b" || d.row.status !== "invited") throw new Error("This invite has expired");
  const { db, row } = d;
  if (!accept) {
    await patchDuel(db, row, "invited", { status: "declined" });
    return;
  }
  await leaveOtherDuels(db, profile.id, duelId);
  const questions = await duelQuestions(db, [
    { id: row.player_a, rating: row.rating_a, language: row.lang_a },
    { id: profile.id, rating, language: profile.language },
  ]);
  const now = new Date().toISOString();
  const started = await patchDuel(db, row, "invited", {
    status: "active", question_ids: questions.map((q) => q.id), rating_b: rating, lang_b: profile.language,
    started_at: now, seen_b: now, // seen_a stays: the challenger counts as there once their phone polls
  });
  if (!started) throw new Error("This invite has expired");
}

// One answer per round; a wrong one freezes the player for the round (SCORE.md §4).
// The server's receive time decides who was first.
export async function answerDuel(duelId: string, round: number, answer: string): Promise<{ correct: boolean | null }> {
  const receivedAt = new Date().toISOString(); // before any database round trip
  if (!LETTERS.includes(answer) || !Number.isInteger(round)) throw new Error("Invalid answer");
  const d = await loadDuel(duelId);
  if (!d || d.row.status !== "active") throw new Error("This duel is over");
  const r = d.state.rounds.at(-1);
  if (!r || r.round !== round || r.endAt !== null || Date.parse(receivedAt) < r.revealAt) return { correct: null }; // not open
  const [question] = await loadBank(d.db, [d.row.question_ids[round - 1]]);
  const key = question.content[d.profile.language] ?? question.content.en!;
  const correct = answer === key.answer;
  const stored = await insertAnswer(d.db, {
    duel_id: duelId, round, user_id: d.profile.id, question_id: question.id, answer, correct,
    answered_at: receivedAt,
  });
  return { correct: stored ? correct : null };
}

// The signed-in player's XP and rating change once the duel is over, recorded once
// (ref duel:<id>). The first phone to claim settles both players (settleDuel).
export async function claimDuel(duelId: string) {
  const d = await loadDuel(duelId);
  if (!d || d.row.status !== "done") return null;
  const reward = await settleDuel(d);
  const { totalXp } = await getXpSummary(d.profile.id);
  const before = d.db ? totalXp - reward.xp : totalXp; // recorded by now; the demo never stores XP
  return { ...reward, levelUp: getLevel(before + reward.xp).level > getLevel(before).level };
}

// Block (never matched or invited again) and optionally report the human opponent.
export async function blockOpponent(duelId: string, report: boolean) {
  const d = await loadDuel(duelId);
  if (!d || d.opponent === BOT) throw new Error("Nothing to block");
  if (!d.db) return;
  await d.db.from("play_blocks").upsert({ user_id: d.profile.id, blocked_id: d.opponent }, { ignoreDuplicates: true });
  // One report per duel (play_reports_once).
  if (report) {
    await d.db.from("play_reports").upsert({ reporter: d.profile.id, reported: d.opponent, duel_id: duelId },
      { onConflict: "reporter,duel_id", ignoreDuplicates: true });
  }
}

// One of the 4 preset reactions, shown to the opponent for a few seconds. No free text.
export async function reactDuel(duelId: string, reaction: string) {
  if (!REACTIONS.includes(reaction)) throw new Error("Invalid reaction");
  const d = await loadDuel(duelId, { touch: false });
  if (!d?.db || d.opponent === BOT || (d.row.status !== "active" && d.row.status !== "done")) return;
  if (await blocked(d.db, d.profile.id, d.opponent)) return;
  const column = d.side === "a" ? "react_a" : "react_b";
  const last = d.row[column];
  if (last && d.now - Date.parse(last.at) < 1_000) return; // at most one a second
  await d.db.from("play_duels").update({ [column]: { r: reaction, at: new Date(d.now).toISOString() } }).eq("id", duelId);
}

// Rematch (RECOMMENDATION.md §6): once both players tapped within 15 s of each other a new
// duel starts, in the same mode, so it counts toward the pair cap. Returns it, or null
// while waiting for the other player.
export async function requestRematch(duelId: string): Promise<{ duelId: string | null }> {
  const { profile, rating } = await player();
  const d = await loadDuel(duelId, { touch: false });
  if (!d?.db || d.opponent === BOT || d.row.status !== "done") throw new Error("No rematch for this duel");
  const { db, row, side, opponent } = d;
  if (row.rematch_id) return { duelId: row.rematch_id };
  if (await blocked(db, profile.id, opponent)) throw new Error("No rematch for this duel");
  const tap: RematchTap = { at: new Date().toISOString(), rating, language: profile.language };
  must(await db.from("play_duels").update({ [side === "a" ? "rematch_a" : "rematch_b"]: tap }).eq("id", duelId).select("id").single());
  const fresh = must(await db.from("play_duels").select("rematch_a, rematch_b, rematch_id").eq("id", duelId).single());
  if (fresh.rematch_id) return { duelId: fresh.rematch_id };
  const theirs: RematchTap | null = side === "a" ? fresh.rematch_b : fresh.rematch_a;
  if (!theirs || Date.now() - Date.parse(theirs.at) > REMATCH_MS) return { duelId: null };

  // Both tapped: whoever claims rematch_id creates the duel.
  const id = crypto.randomUUID();
  const claimed = await db.from("play_duels").update({ rematch_id: id }).eq("id", duelId).is("rematch_id", null).select("id");
  if (!claimed.data?.length) return { duelId: null }; // the other phone claimed it: the poll brings its id
  try {
    await leaveOtherDuels(db, profile.id);
    await leaveOtherDuels(db, opponent);
    const questions = await duelQuestions(db, [
      { id: profile.id, rating, language: profile.language },
      { id: opponent, rating: theirs.rating, language: theirs.language },
    ]);
    await insertDuel(db, {
      id, mode: row.mode, player_a: profile.id, player_b: opponent, status: "active",
      question_ids: questions.map((q) => q.id), bot: null, rating_a: rating, rating_b: theirs.rating,
      lang_a: profile.language, lang_b: theirs.language, started_at: new Date(Date.now() + MATCH_LOAD_MS).toISOString(),
    });
  } catch (error) {
    await db.from("play_duels").update({ rematch_id: null }).eq("id", duelId);
    throw error;
  }
  return { duelId: id };
}

// Classroom code (RECOMMENDATION.md §6): a 6-character code, valid for 10 minutes, that a
// classmate who isn't a friend yet types in. One code per student at a time.
export async function createCode(): Promise<{ code: string; expiresAt: number }> {
  const { profile, rating, db } = await player();
  if (!db) throw new Error("Classroom codes need the database");
  await leaveOtherDuels(db, profile.id);
  await db.from("play_codes").delete().eq("user_id", profile.id);
  for (let i = 0; i < 5; i++) {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
    const { error } = await db.from("play_codes").insert({ code, user_id: profile.id, rating, language: profile.language });
    if (!error) return { code, expiresAt: Date.now() + CODE_MS };
    if (error.code !== "23505") break;
  }
  throw new Error("Couldn't create a code");
}

// Polled every 2 s by the code's owner: the duel once a classmate joined.
export async function codeStatus(): Promise<{ duelId: string | null; expired: boolean }> {
  const { profile, db } = await player();
  const row = db && (await db.from("play_codes").select("duel_id, created_at").eq("user_id", profile.id).maybeSingle()).data;
  if (!db || !row) return { duelId: null, expired: true };
  if (row.duel_id) {
    // The joiner creates the duel right after claiming the code: wait until it exists.
    const exists = (await db.from("play_duels").select("id").eq("id", row.duel_id).maybeSingle()).data;
    if (!exists) return { duelId: null, expired: false };
    await db.from("play_codes").delete().eq("user_id", profile.id);
    return { duelId: row.duel_id, expired: false };
  }
  return { duelId: null, expired: Date.now() - Date.parse(row.created_at) > CODE_MS };
}

export async function cancelCode() {
  const { profile, db } = await player();
  if (db) await db.from("play_codes").delete().eq("user_id", profile.id).is("duel_id", null);
}

// The classmate types the code in; the duel starts at once.
export async function joinCode(input: string): Promise<string> {
  const code = typeof input === "string" ? input.trim().toUpperCase() : "";
  const { profile, rating, db } = await player();
  const owner = db && code.length === 6 && [...code].every((c) => CODE_ALPHABET.includes(c))
    ? (await db.from("play_codes").select("user_id, rating, language").eq("code", code).is("duel_id", null)
        .gte("created_at", new Date(Date.now() - CODE_MS).toISOString()).maybeSingle()).data
    : null;
  if (!db || !owner || owner.user_id === profile.id || (await blocked(db, profile.id, owner.user_id))) {
    throw new Error("This code isn't valid");
  }
  await leaveOtherDuels(db, profile.id);
  const questions = await duelQuestions(db, [
    { id: profile.id, rating, language: profile.language },
    { id: owner.user_id, rating: owner.rating, language: owner.language },
  ]);
  const id = crypto.randomUUID();
  const claimed = await db.from("play_codes").update({ duel_id: id }).eq("code", code).is("duel_id", null).select("code");
  if (!claimed.data?.length) throw new Error("This code isn't valid"); // someone else joined first
  try {
    await insertDuel(db, {
      id, mode: "code", player_a: profile.id, player_b: owner.user_id, status: "active",
      question_ids: questions.map((q) => q.id), bot: null, rating_a: rating, rating_b: owner.rating,
      lang_a: profile.language, lang_b: owner.language, started_at: new Date(Date.now() + MATCH_LOAD_MS).toISOString(),
    });
  } catch (error) {
    await db.from("play_codes").update({ duel_id: null }).eq("code", code);
    throw error;
  }
  return id;
}

// Duels (SCORE.md §4 and §8, QUESTIONS.md §5). Pure: duelStore.ts loads and saves,
// these decide rounds, winners and rewards.
import { expectedScore, getSkillTier, tierDiff } from "../../shared/rating.ts";
import { PILLARS, TIERS, type Language, type Pillar } from "../../shared/types.ts";
import { shuffle, type BankQuestion } from "./engine.ts";

export const ROUNDS = 5;
export const ROUND_MS = 30_000;
export const LEAD_MS = 3_000; // each question reaches the phones this long before its reveal
export const GAP_MS = 4_000; // pause between a round's end and the next reveal
export const LEFT_MS = 15_000; // no poll for this long = the player left
export const INVITE_MS = 60_000;
export const BOT = "bot";
export const REACTIONS = ["👍", "🔥", "😮", "GG"]; // the only messages between players (RECOMMENDATION.md §6)
export const REACTION_SHOW_MS = 3_000;
export const REMATCH_MS = 15_000; // the other player has this long to tap Rematch too
export const CODE_MS = 600_000; // a classroom code is valid for 10 minutes
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
export const PAIR_DAILY_CAP = 3; // duels per pair per IST day that earn XP (SCORE.md §4)
export const BOT_DAILY_CAP = 5; // bot duels per student per IST day that earn XP (SCORE.md §4)

export type BotRoll = { correct: boolean; ms: number }; // ms after the reveal
export type DuelAnswer = { round: number; who: string; correct: boolean; at: number };
export type Round = {
  round: number;
  revealAt: number;
  endAt: number | null; // null while the round is upcoming or running
  winner: string | null;
  points: number;
  frozen: string[]; // answered wrong
};

// Plays the rounds out from the answers that reached the server by `now`. A round ends
// on the first correct answer, when both players are frozen, or after 30 s; the next one
// is revealed GAP_MS later. The bot's rolled answers count once their time has come.
export function duelRounds(
  startedAt: number,
  answers: DuelAnswer[],
  bot: BotRoll[] | null,
  now: number,
): { rounds: Round[]; done: boolean } {
  const rounds: Round[] = [];
  let revealAt = startedAt + LEAD_MS;
  for (let n = 1; n <= ROUNDS; n++) {
    const timeUp = revealAt + ROUND_MS;
    const events = answers.filter((a) => a.round === n);
    if (bot) events.push({ round: n, who: BOT, correct: bot[n - 1].correct, at: revealAt + bot[n - 1].ms });
    const round: Round = { round: n, revealAt, endAt: null, winner: null, points: 0, frozen: [] };
    for (const e of events.filter((e) => e.at <= now && e.at < timeUp).sort((x, y) => x.at - y.at)) {
      if (e.correct) {
        round.winner = e.who;
        round.endAt = e.at;
        break;
      }
      round.frozen.push(e.who);
      if (round.frozen.length === 2) {
        round.endAt = e.at;
        break;
      }
    }
    if (round.endAt === null && now >= timeUp) round.endAt = timeUp;
    if (round.winner) round.points = 100 + Math.round((50 * (timeUp - round.endAt!)) / ROUND_MS);
    rounds.push(round);
    if (round.endAt === null) return { rounds, done: false };
    revealAt = round.endAt + GAP_MS;
  }
  return { rounds, done: true };
}

// How a duel ends when a player leaves (SCORE.md §4): cancelled while round 1 is running
// with no answer yet (the bot's count) or when the leaver never opened the started duel;
// done with no forfeit when the rounds already played out; otherwise the leaver loses.
export function leaveOutcome(state: { rounds: Round[]; done: boolean }, leaverOpened: boolean): "cancelled" | "done" | "forfeit" {
  if (state.done) return "done";
  const first = state.rounds[0];
  if (!leaverOpened || !first || (first.endAt === null && first.frozen.length === 0)) return "cancelled";
  return "forfeit";
}

// Who left, as seen by a player loading the duel: nobody while the opponent polled within
// LEFT_MS; otherwise the opponent, unless this player was gone too and for longer (coming
// back to a duel they walked out of doesn't win it). Times are last polls (ms).
export function whoLeft(now: number, mine: number, theirs: number): "me" | "opponent" | null {
  if (now - theirs <= LEFT_MS) return null;
  return now - mine > LEFT_MS && mine <= theirs ? "me" : "opponent";
}

// 1 win, 0.5 draw, 0 loss for `player`. Leaving loses (SCORE.md §4).
export function duelOutcome(rounds: Round[], player: string, opponent: string, forfeit: string | null) {
  const total = (p: string) => rounds.reduce((n, r) => n + (r.winner === p ? r.points : 0), 0);
  const roundsWon = rounds.filter((r) => r.winner === player).length;
  const [mine, theirs] = [total(player), total(opponent)];
  const result: 1 | 0.5 | 0 = forfeit ? (forfeit === player ? 0 : 1) : mine > theirs ? 1 : mine === theirs ? 0.5 : 0;
  return { result, roundsWon, score: mine, opponentScore: theirs };
}

// XP (SCORE.md §4) and rating change (SCORE.md §8) for one player. Bot duels give half;
// past the daily pair cap nothing changes; past 300 XP today the XP is halved again
// (SCORE.md §3 daily soft cap, which counts duel XP).
export function duelReward(a: {
  result: 1 | 0.5 | 0;
  roundsWon: number;
  rating: number;
  opponentRating: number;
  bot: boolean;
  capped: boolean;
  overDailyCap?: boolean;
}): { xp: number; ratingDelta: number } {
  if (a.capped) return { xp: 0, ratingDelta: 0 };
  const gap = Math.round((a.opponentRating - a.rating) / 25);
  const base = a.result === 1 ? Math.min(60, Math.max(10, 30 + 3 * gap)) : a.result === 0.5 ? 15 : 0;
  const xp = base + 2 * a.roundsWon;
  const ratingDelta = Math.round((a.bot ? 12 : 24) * (a.result - expectedScore(a.rating, a.opponentRating))) || 0;
  const halved = a.bot ? Math.round(xp / 2) : xp;
  return { xp: a.overDailyCap && halved ? Math.max(1, Math.round(halved / 2)) : halved, ratingDelta };
}

// Paisa Bot at the student's rating (QUESTIONS.md §5): 85% / 70% / 45% for a question
// below / at / above their skill tier, landing 6–15 s after the reveal.
export function rollBot(questions: BankQuestion[], rating: number, random = Math.random): BotRoll[] {
  const tier = getSkillTier(rating);
  return questions.map((q) => {
    const d = tierDiff(q.tier, tier);
    return { correct: random() < (d < 0 ? 0.85 : d === 0 ? 0.7 : 0.45), ms: 6_000 + Math.floor(random() * 9_001) };
  });
}

// Five questions (QUESTIONS.md §5): rounds 1–2 one tier below the average rating's
// tier, 3–4 at it, 5 one above; one per pillar plus a random one. Relaxed in order:
// answered by either player in 30 days, both languages (English fallback), still
// calibrating, then tier, then pillar.
export function pickDuel(a: {
  bank: BankQuestion[];
  ratings: number[];
  languages: Language[];
  answered: Set<string>;
  pillar?: Pillar;
  random?: () => number;
}): BankQuestion[] {
  const random = a.random ?? Math.random;
  const t = TIERS.indexOf(getSkillTier(a.ratings.reduce((n, r) => n + r, 0) / a.ratings.length));
  const tiers = [t - 1, t - 1, t, t, t + 1].map((i) => TIERS[Math.max(0, Math.min(TIERS.length - 1, i))]);
  const pillars: Pillar[] = a.pillar
    ? Array(ROUNDS).fill(a.pillar)
    : shuffle([...PILLARS, PILLARS[Math.floor(random() * PILLARS.length)]], random);
  const chosen: BankQuestion[] = [];
  const fits = (q: BankQuestion, i: number, relax: number) =>
    !chosen.includes(q) &&
    (relax >= 1 || !a.answered.has(q.id)) &&
    (relax >= 2 ? Boolean(q.content.en) : a.languages.every((l) => q.content[l])) &&
    (relax >= 3 || (q.answers_count ?? 0) >= 30) &&
    (relax >= 4 || q.tier === tiers[i]) &&
    (relax >= 5 || q.pillar === pillars[i]);
  for (let i = 0; i < ROUNDS; i++) {
    for (let relax = 0; relax <= 5; relax++) {
      const pool = a.bank.filter((q) => fits(q, i, relax));
      if (pool.length) {
        chosen.push(pool[Math.floor(random() * pool.length)]);
        break;
      }
    }
  }
  return chosen;
}

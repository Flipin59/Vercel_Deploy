import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { TIERS } from "../../shared/types.ts";
import { BOT, GAP_MS, LEAD_MS, ROUND_MS, duelOutcome, duelReward, duelRounds, leaveOutcome, pickDuel, rollBot, whoLeft } from "./duel.ts";
import type { BankQuestion } from "./engine.ts";

const dir = new URL("./data/questions/", import.meta.url);
const bank: BankQuestion[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
const T0 = 1_000_000;
const R1 = T0 + LEAD_MS; // round 1 reveal

test("fastest finger: first correct answer takes the round, with the speed bonus", () => {
  const answers = [
    { round: 1, who: "a", correct: false, at: R1 + 2_000 }, // a frozen
    { round: 1, who: "b", correct: true, at: R1 + 15_000 }, // half the time left
  ];
  const { rounds } = duelRounds(T0, answers, null, R1 + 20_000);
  assert.deepEqual(rounds[0], { round: 1, revealAt: R1, endAt: R1 + 15_000, winner: "b", points: 125, frozen: ["a"] });
  assert.equal(rounds[1].revealAt, R1 + 15_000 + GAP_MS);
  assert.equal(rounds[1].endAt, null);
});

test("a round ends when both are frozen or time runs out; the bot counts once it has landed", () => {
  const bot = Array(5).fill({ correct: true, ms: 8_000 });
  // Before the bot's time it hasn't answered; after it, it took the round.
  assert.equal(duelRounds(T0, [], bot, R1 + 7_000).rounds[0].winner, null);
  assert.equal(duelRounds(T0, [], bot, R1 + 9_000).rounds[0].winner, BOT);
  // A correct answer that beats the bot wins; both frozen ends the round early.
  const wrongBot = Array(5).fill({ correct: false, ms: 6_000 });
  const both = duelRounds(T0, [{ round: 1, who: "a", correct: false, at: R1 + 1_000 }], wrongBot, R1 + 10_000);
  assert.equal(both.rounds[0].endAt, R1 + 6_000);
  const timeout = duelRounds(T0, [], null, R1 + ROUND_MS);
  assert.equal(timeout.rounds[0].endAt, R1 + ROUND_MS);
  assert.equal(timeout.rounds[0].winner, null);
  // Five timed-out rounds finish the duel.
  assert.ok(duelRounds(T0, [], null, T0 + 5 * (LEAD_MS + ROUND_MS + GAP_MS)).done);
});

test("outcome and rewards follow SCORE.md §4 and §8", () => {
  const { rounds } = duelRounds(T0, [{ round: 1, who: "a", correct: true, at: R1 + 1_000 }], null, R1 + 5_000);
  assert.deepEqual(duelOutcome(rounds, "a", "b", null), { result: 1, roundsWon: 1, score: 148, opponentScore: 0 });
  assert.equal(duelOutcome(rounds, "a", "b", "a").result, 0); // leaving loses
  const win = (rating: number, opponentRating: number) =>
    duelReward({ result: 1, roundsWon: 0, rating, opponentRating, bot: false, capped: false }).xp;
  assert.deepEqual([win(1000, 1000), win(1000, 1125), win(1125, 1000), win(1500, 900)], [30, 45, 15, 10]);
  assert.deepEqual(duelReward({ result: 1, roundsWon: 3, rating: 1000, opponentRating: 1000, bot: false, capped: false }), { xp: 36, ratingDelta: 12 });
  assert.deepEqual(duelReward({ result: 0, roundsWon: 2, rating: 1000, opponentRating: 1000, bot: false, capped: false }), { xp: 4, ratingDelta: -12 });
  assert.deepEqual(duelReward({ result: 0.5, roundsWon: 2, rating: 1000, opponentRating: 1000, bot: true, capped: false }), { xp: 10, ratingDelta: 0 });
  assert.deepEqual(duelReward({ result: 1, roundsWon: 5, rating: 900, opponentRating: 1200, bot: false, capped: true }), { xp: 0, ratingDelta: 0 });
});

test("pickDuel: five distinct questions, tiers below/at/above, every pillar", () => {
  const qs = pickDuel({ bank, ratings: [1000, 1000], languages: ["en"], answered: new Set(), random: () => 0.5 });
  assert.equal(new Set(qs.map((q) => q.id)).size, 5);
  assert.deepEqual(qs.map((q) => q.tier), ["bronze", "bronze", "silver", "silver", "gold"]);
  assert.deepEqual(new Set(qs.map((q) => q.pillar)).size, 4);
  const budget = pickDuel({ bank, ratings: [800, 800], languages: ["en"], answered: new Set(), pillar: "budget" });
  assert.ok(budget.every((q) => q.pillar === "budget"));
  assert.ok(budget.every((q) => TIERS.indexOf(q.tier) <= 1));
});

test("rollBot follows the tier odds and lands in 6–15 s", () => {
  const q = (tier: BankQuestion["tier"]) => ({ ...bank[0], tier });
  assert.deepEqual(rollBot([q("bronze"), q("silver"), q("gold")], 1000, () => 0.6).map((r) => r.correct), [true, true, false]);
  for (const r of rollBot(bank.slice(0, 20), 1000)) assert.ok(r.ms >= 6_000 && r.ms <= 15_000);
});

test("leaving: cancelled only before round 1 is answered or if never opened; finished duels stay finished", () => {
  const bot = Array(5).fill({ correct: true, ms: 8_000 });
  // Round 1 running, nobody answered: cancelled. The bot answering counts (W3-P2).
  assert.equal(leaveOutcome(duelRounds(T0, [], null, R1 + 5_000), true), "cancelled");
  assert.equal(leaveOutcome(duelRounds(T0, [], bot, R1 + 9_000), true), "forfeit");
  // Round 1 timed out with no answers: later leaving still loses (W3-P9).
  assert.equal(leaveOutcome(duelRounds(T0, [], null, R1 + ROUND_MS + GAP_MS + 1_000), true), "forfeit");
  // A wrong answer in round 1 is an answer.
  assert.equal(leaveOutcome(duelRounds(T0, [{ round: 1, who: "a", correct: false, at: R1 + 1_000 }], null, R1 + 2_000), true), "forfeit");
  // Never opened the started duel (abandoned invite, quick-match ghost): cancelled (W3-P8).
  assert.equal(leaveOutcome(duelRounds(T0, [], bot, R1 + 9_000), false), "cancelled");
  // All five rounds played out by time: finished, not forfeited.
  assert.equal(leaveOutcome(duelRounds(T0, [], bot, T0 + 10 * 60_000), true), "done");
});

test("past the daily soft cap duel XP is halved, losses stay 0", () => {
  const base = { result: 1 as const, roundsWon: 3, rating: 800, opponentRating: 800, bot: false, capped: false };
  assert.equal(duelReward(base).xp, 36);
  assert.equal(duelReward({ ...base, overDailyCap: true }).xp, 18);
  assert.equal(duelReward({ ...base, result: 0, roundsWon: 0, overDailyCap: true }).xp, 0);
});

test("who left: the opponent after 15 s, but not when I was gone longer", () => {
  const now = 1_000_000;
  assert.equal(whoLeft(now, now - 1_000, now - 10_000), null); // both here
  assert.equal(whoLeft(now, now - 1_000, now - 20_000), "opponent"); // they stopped polling
  assert.equal(whoLeft(now, now - 60_000, now - 20_000), "me"); // I walked out first, came back
  assert.equal(whoLeft(now, now - 20_000, now - 60_000), "opponent"); // they walked out first
});

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { TIERS } from "../../shared/types.ts";
import { pick, pickPractice, scoreFirstTry, type BankQuestion, type PickInput } from "./engine.ts";

const dir = new URL("./data/questions/", import.meta.url);
const bank: BankQuestion[] = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")));
const NOW = Date.parse("2026-10-11T00:00:00Z");
const DAY = 86_400_000;
const input = (over: Partial<PickInput> = {}): PickInput => ({
  bank, language: "en", rating: 800, pillarXp: { budget: 0, save: 0, invest: 0, safety: 0 },
  history: [], shown: new Set(), now: NOW, random: () => 0.5, ...over,
});
const tierOf = (q: BankQuestion) => TIERS.indexOf(q.tier);

test("practice: 10 distinct questions, no shared tags, easiest first, at every rating", () => {
  for (const rating of [700, 850, 950, 1050, 1250, 1450, 1700]) {
    const qs = pickPractice(input({ rating }));
    assert.equal(qs.length, 10, `rating ${rating}`);
    const tags = qs.flatMap((q) => q.tags);
    assert.equal(new Set(tags).size, tags.length, `tags at ${rating}`);
    assert.ok(qs.every((q, i) => i === 0 || tierOf(qs[i - 1]) <= tierOf(q)), `order at ${rating}`);
  }
});

test("practice: weakest pillar gets 4, a chosen pillar gets all 10, recent ones are skipped", () => {
  const weak = pickPractice(input({ rating: 1000, pillarXp: { budget: 50, save: 50, invest: 0, safety: 50 } }));
  assert.equal(weak.filter((q) => q.pillar === "invest").length, 4);
  assert.ok(pickPractice(input({ pillar: "safety" })).every((q) => q.pillar === "safety"));
  const first = pickPractice(input());
  const again = pickPractice(input({ shown: new Set(first.map((q) => q.id)) }));
  assert.ok(again.every((q) => !first.some((f) => f.id === q.id)));
});

test("practice: a missed question comes back once it is due", () => {
  const missed = bank.find((q) => q.tier === "bronze")!;
  const history = [{ questionId: missed.id, correct: false, at: NOW - 2 * DAY }];
  // A Diamond student would never get this Bronze question except as a review.
  assert.ok(pickPractice(input({ history, rating: 1700 })).some((q) => q.id === missed.id));
  const notDue = [{ questionId: missed.id, correct: false, at: NOW - DAY / 2 }];
  assert.ok(!pickPractice(input({ history: notDue, rating: 1700 })).some((q) => q.id === missed.id));
});

test("practice: a chosen pillar still fills all 10, and reviews stay in it", () => {
  for (const pillar of ["budget", "save", "invest", "safety"] as const) {
    for (const rating of [800, 1050, 1450]) {
      const qs = pickPractice(input({ pillar, rating }));
      assert.equal(qs.length, 10, `${pillar} at ${rating}`);
      assert.ok(qs.every((q) => q.pillar === pillar));
    }
  }
  const missed = bank.find((q) => q.pillar === "budget")!;
  const history = [{ questionId: missed.id, correct: false, at: NOW - 2 * DAY }];
  assert.ok(!pickPractice(input({ history, pillar: "safety" })).some((q) => q.id === missed.id));
});

test("practice: +3 for questions on a reel or chapter from the last 7 days", () => {
  const base = input({ rating: 800, random: () => 0 });
  const plain = new Set(pickPractice(base).map((q) => q.id));
  // A linked question the quiz leaves out without the signal is picked with it.
  const reelQ = bank.find((q) => q.reel_id && q.tier === "bronze" && q.content.en && !plain.has(q.id))!;
  assert.ok(pickPractice({ ...base, recentReels: [reelQ.reel_id!] }).some((q) => q.id === reelQ.id));
  const chapterQ = bank.find((q) => q.chapter_slug && q.tier === "bronze" && q.content.en && !plain.has(q.id))!;
  assert.ok(pickPractice({ ...base, recentChapters: [chapterQ.chapter_slug!] }).some((q) => q.chapter_slug === chapterQ.chapter_slug));
});

test("chapter, reel and placement quizzes", () => {
  const chapter = pick("chapter", input({ chapterSlug: "save-emergency-fund" }));
  assert.equal(chapter.length, 5);
  assert.ok(chapter.every((q) => q.chapter_slug === "save-emergency-fund"));
  const reelIds = ["budget-needs-vs-wants", "budget-50-30-20", "save-emergency-fund", "safety-never-share-otp", "budget-chai-math"];
  const reel = pick("reel", input({ reelIds }));
  assert.equal(reel.length, 3);
  assert.ok(reel.every((q) => q.reel_id && reelIds.includes(q.reel_id)));
  assert.equal(pick("reel", input({ reelIds: ["budget-chai-math"] })).length, 3); // topped up by tag
  // Questions on completed reels come first (QUESTIONS.md §6).
  const preferred = pick("reel", input({ reelIds, completedReels: ["safety-never-share-otp"] }));
  assert.ok(preferred.some((q) => q.reel_id === "safety-never-share-otp"));
  // A reel with no linked questions still gets a quiz from its manifest tags (W3-P10).
  const fromTags = pick("reel", input({ reelIds: ["no-questions-reel"], reelTags: ["upi-fraud"] }));
  assert.equal(fromTags.length, 3);
  assert.ok(fromTags.every((q) => q.tags.includes("upi-fraud")));
  const placement = pick("placement", input());
  assert.deepEqual(placement.map((q) => q.tier), ["bronze", "bronze", "bronze", "silver", "silver", "silver", "gold", "gold"]);
  assert.ok(placement.every((q) => !q.reel_id && !q.chapter_slug));
});

test("scoreFirstTry follows SCORE.md §3 and §8 and QUIZ.md §6", () => {
  const base = { context: "practice" as const, tier: "silver" as const, rating: 1000, correct: true, timeMs: 15_000, history: [], todayXp: 0, now: NOW };
  // SCORE.md §8 example: Silver vs 1000, half the time left → +3; wrong → −2.
  assert.deepEqual(scoreFirstTry(base), { xp: 10, coins: 3, ratingDelta: 3 });
  assert.deepEqual(scoreFirstTry({ ...base, correct: false }), { xp: 0, coins: 0, ratingDelta: -2 });
  assert.equal(scoreFirstTry({ ...base, tier: "diamond" }).xp, 20); // 2+ tiers above ×2
  assert.equal(scoreFirstTry({ ...base, tier: "bronze" }).xp, 5); // 1 below ×0.5
  assert.equal(scoreFirstTry({ ...base, context: "chapter" }).xp, 5);
  assert.equal(scoreFirstTry({ ...base, todayXp: 300 }).xp, 5); // daily soft cap
  const repeat = scoreFirstTry({ ...base, history: [{ questionId: "q", correct: true, at: NOW - DAY }] });
  assert.deepEqual([repeat.xp, repeat.coins], [0, 0]);
  assert.ok(repeat.ratingDelta > 0);
  assert.equal(scoreFirstTry({ ...base, history: [{ questionId: "q", correct: false, at: NOW - 2 * DAY }] }).xp, 5); // review
  assert.deepEqual(scoreFirstTry({ ...base, context: "placement" }).xp, 40);
  assert.equal(scoreFirstTry({ ...base, context: "placement" }).coins, 0);
});

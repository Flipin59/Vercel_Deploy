import assert from "node:assert/strict";
import test from "node:test";
import { getBadges, getWeeklyGoals } from "./badges.ts";

const none = { kinds: {}, streakDays: 0, pillarXp: { budget: 0, save: 0, invest: 0, safety: 0 } };
const earned = (input: Parameters<typeof getBadges>[0]) => getBadges(input).filter((b) => b.earned).map((b) => b.id);

test("badges follow the student's activity", () => {
  assert.deepEqual(earned(none), []);
  assert.equal(getBadges(none).length, 11);
  assert.deepEqual(earned({ ...none, kinds: { reel_watched: 9, duel_won: 1 } }), ["first-reel", "first-duel-win"]);
  assert.deepEqual(
    earned({ kinds: { reel_watched: 10, chapter_finished: 3, answer_accepted: 2 }, streakDays: 7, pillarXp: { budget: 100, save: 99, invest: 0, safety: 250 } }),
    ["first-reel", "reels-10", "first-chapter", "chapters-3", "streak-7", "helper", "pillar-budget", "pillar-safety"],
  );
});

test("weekly goals cap at their targets and count distinct features", () => {
  assert.deepEqual(getWeeklyGoals(40, ["play", "play", "reels"]), [
    { id: "xp", value: 40, target: 100 },
    { id: "variety", value: 2, target: 3 },
  ]);
  assert.deepEqual(getWeeklyGoals(900, ["play", "reels", "learn", "forum"]).map((g) => g.value), [100, 3]);
});

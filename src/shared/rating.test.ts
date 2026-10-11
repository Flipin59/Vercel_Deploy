import assert from "node:assert/strict";
import test from "node:test";
import { expectedScore, getLevel, getSkillTier, getTitle, tierDiff } from "./rating.ts";

test("getLevel", () => {
  assert.deepEqual(getLevel(0), { level: 1, progress: 0 });
  assert.deepEqual(getLevel(250), { level: 3, progress: 50 });
  assert.deepEqual(getLevel(-5), { level: 1, progress: 0 });
});

test("getTitle matches the RATING.md §3 table", () => {
  const table: [number, string][] = [
    [1, "Bronze 3"], [5, "Bronze 3"], [6, "Bronze 2"], [15, "Bronze 1"],
    [16, "Silver 3"], [33, "Silver 1"], [34, "Gold 3"], [54, "Gold 1"],
    [55, "Platinum 3"], [78, "Platinum 1"], [79, "Diamond 3"], [88, "Diamond 3"],
    [89, "Diamond 2"], [98, "Diamond 2"], [99, "Diamond 1"], [500, "Diamond 1"],
  ];
  for (const [level, label] of table) assert.equal(getTitle(level).label, label, `level ${level}`);
  // Total XP at the start of a title (RATING.md §3) lands on that title.
  assert.equal(getTitle(getLevel(1500).level).label, "Silver 3");
  assert.equal(getTitle(getLevel(9800).level).label, "Diamond 1");
});

test("skill tiers and Elo", () => {
  assert.equal(getSkillTier(899), "bronze");
  assert.equal(getSkillTier(900), "silver");
  assert.equal(getSkillTier(1500), "diamond");
  assert.equal(tierDiff("gold", "bronze"), 2);
  assert.equal(tierDiff("bronze", "silver"), -1);
  assert.equal(expectedScore(1000, 1000), 0.5);
  assert.ok(expectedScore(1200, 1000) > 0.75);
});

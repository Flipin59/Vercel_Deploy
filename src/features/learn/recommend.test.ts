import assert from "node:assert/strict";
import test from "node:test";
import type { ContentItem, Pillar, RecUser } from "../../shared/types.ts";
import { recommendChapters, type ChapterProgress } from "./recommend.ts";

const item = (id: string, pillar: Pillar, level: number, requires: string[] = []): ContentItem => ({
  id, kind: "chapter", pillar, tags: [], level, language: "en", createdAt: "2026-10-11", requires,
  stats: { views: 0, likes: 0, saves: 0, completions: 0 }, friendsEngaged: 0,
});
const user = (level: number): RecUser => ({
  id: "u", level, language: "en", pillarXp: { budget: 0, save: 0, invest: 0, safety: 0 },
  tagInterest: {}, recentWrongTags: [], reelsWatched: 0, chaptersOpened: 0,
});
const ids = (r: { item: ContentItem }[]) => r.map((x) => x.item.id);
const flat = () => 0.5;

test("skips started chapters and unmet prerequisites", () => {
  const items = [item("a", "budget", 1), item("b", "budget", 2, ["a"]), item("c", "save", 1), item("d", "safety", 1)];
  const progress: ChapterProgress[] = [{ slug: "c", lastPage: 2, updatedAt: "", finishedAt: null }];
  assert.deepEqual(ids(recommendChapters(items, user(1), progress, flat)).sort(), ["a", "d"]);
  const done: ChapterProgress[] = [{ slug: "a", lastPage: 3, updatedAt: "", finishedAt: "2026-10-11" }];
  assert.ok(ids(recommendChapters(items, user(1), done, flat)).includes("b"));
});

test("level window widens to at most L−23 … L+19", () => {
  const items = [item("near", "budget", 5), item("edge", "save", 20), item("far", "invest", 21)];
  assert.deepEqual(ids(recommendChapters(items, user(1), [], flat)).sort(), ["edge", "near"]);
});

test("prefers different pillars, then fills by score", () => {
  const items = [item("b1", "budget", 1), item("b2", "budget", 1), item("s1", "save", 1)];
  const score = (i: ContentItem) => ({ b1: 0.9, b2: 0.8, s1: 0.1 })[i.id] ?? 0;
  assert.deepEqual(ids(recommendChapters(items, user(1), [], score, 2)), ["b1", "s1"]);
  assert.deepEqual(ids(recommendChapters(items, user(1), [], score, 3)), ["b1", "b2", "s1"]);
});

test("scores against the filtered pool, not every chapter", () => {
  const items = [item("in", "budget", 1), item("started", "save", 1), item("far", "invest", 90)];
  const progress: ChapterProgress[] = [{ slug: "started", lastPage: 1, updatedAt: "", finishedAt: null }];
  let seen: string[] = [];
  recommendChapters(items, user(1), progress, (_i, pool) => ((seen = pool.map((p) => p.id)), 0.5));
  assert.deepEqual(seen, ["in"]);
});

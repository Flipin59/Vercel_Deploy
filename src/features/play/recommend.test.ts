import assert from "node:assert/strict";
import test from "node:test";
import type { ContentItem, Pillar, RecUser, Tag } from "@/shared/types";
import { buildFeed, scoreItem } from "./recommend.ts";

const NOW = Date.parse("2026-10-11T00:00:00Z");
const TAGS: Record<Pillar, Tag[]> = {
  budget: ["needs-vs-wants", "50-30-20", "pocket-money"],
  save: ["emergency-fund", "inflation", "compound-interest"],
  invest: ["risk-and-return", "diversification", "time-horizon"],
  safety: ["upi-fraud", "otp-and-pin", "phishing"],
};

const item = (id: string, over: Partial<ContentItem> = {}): ContentItem => ({
  id, kind: "reel", pillar: "budget", tags: ["needs-vs-wants"], level: 10, language: "en",
  createdAt: new Date(NOW).toISOString(), friendsEngaged: 0,
  stats: { views: 0, likes: 0, saves: 0, completions: 0 }, ...over,
});

const user = (over: Partial<RecUser> = {}): RecUser => ({
  id: "u", level: 10, language: "en", pillarXp: { budget: 0, save: 0, invest: 0, safety: 0 },
  tagInterest: {}, recentWrongTags: [], reelsWatched: 50, chaptersOpened: 50, ...over,
});

test("scoreItem uses the §3 weights, new-user weights and remediation", () => {
  const it = item("a", { friendsEngaged: 3 });
  const score = (u: RecUser) => scoreItem(it, u, [it], { now: NOW });
  // topicFit 0.25 (pillarNeed 0.5, no tag history), popularity 0, friends/levelFit/freshness 1.
  assert.equal(score(user()), 0.3 * 0.25 + 0.2 + 0.15 + 0.1);
  assert.equal(score(user({ reelsWatched: 0 })), 0.15 * 0.25 + 0.2 + 0.15 + 0.1);
  assert.equal(score(user({ recentWrongTags: ["needs-vs-wants"] })), 0.3 + 0.2 + 0.15 + 0.1);
});

test("new users take pillarNeed from the onboarding persona", () => {
  const it = item("a");
  const persona = { pillarNeed: { budget: 1, save: 0.6, invest: 0.2, safety: 0.6 } };
  const score = (u: RecUser) => scoreItem(it, u, [it], { now: NOW });
  // topicFit = 0.5 × persona need (no tag history); levelFit and freshness are 1.
  assert.equal(score(user({ reelsWatched: 0, persona })), 0.15 * 0.5 + 0.15 + 0.1);
  assert.equal(score(user({ persona })), 0.3 * 0.25 + 0.15 + 0.1); // not new: XP rule
});

test("popularity smoothing keeps a 2-view item below a proven one", () => {
  const fresh = item("fresh", { stats: { views: 2, likes: 2, saves: 0, completions: 0 } });
  const proven = item("proven", { stats: { views: 200, likes: 180, saves: 0, completions: 0 } });
  const filler = item("filler", { stats: { views: 1000, likes: 100, saves: 0, completions: 0 } });
  const all = [fresh, proven, filler];
  assert.ok(scoreItem(proven, user(), all, { now: NOW }) > scoreItem(fresh, user(), all, { now: NOW }));
});

test("buildFeed filters, keeps variety and allows one stretch item per page", () => {
  const pillars = Object.keys(TAGS) as Pillar[];
  const items = Array.from({ length: 40 }, (_, i) => {
    const pillar = pillars[i % 4];
    return item(`r${i}`, { pillar, tags: [TAGS[pillar][i % 3]], level: 12 + (i % 13), friendsEngaged: i % 4 });
  });
  const extra = [
    item("stretch1", { level: 26 }), item("stretch2", { level: 27, pillar: "save", tags: ["inflation"] }),
    item("tooHigh", { level: 29 }), item("hindi", { level: 20, language: "hi" }),
  ];
  const feed = buildFeed([...items, ...extra], user({ level: 20 }), { now: NOW, random: () => 0 });

  const ids = feed.map((c) => c.id);
  assert.ok(!ids.includes("tooHigh") && !ids.includes("hindi"));
  assert.equal(new Set(ids).size, ids.length);
  // Variety holds while other items remain; the tail may repeat (fallback). Students see 30.
  for (let i = 1; i < 30; i++) {
    assert.ok(!feed[i].tags.some((t) => feed[i - 1].tags.includes(t)), `tag repeat at ${i}`);
    if (i > 1) assert.ok(!(feed[i].pillar === feed[i - 1].pillar && feed[i].pillar === feed[i - 2].pillar), `pillar run at ${i}`);
  }
  for (let p = 0; p < feed.length; p += 10) {
    assert.ok(feed.slice(p, p + 10).filter((c) => c.level > 24).length <= 1, `page ${p / 10}`);
  }
});

test("buildFeed fills every 5th slot at random", () => {
  const pillars = Object.keys(TAGS) as Pillar[];
  const items = Array.from({ length: 20 }, (_, i) =>
    item(`r${i}`, { pillar: pillars[i % 4], tags: [TAGS[pillars[i % 4]][i % 3]], friendsEngaged: i % 4 }));
  const first = buildFeed(items, user(), { now: NOW, random: () => 0 }).map((c) => c.id);
  const last = buildFeed(items, user(), { now: NOW, random: () => 0.999 }).map((c) => c.id);
  assert.deepEqual(first.slice(0, 4), last.slice(0, 4));
  assert.notEqual(first[4], last[4]);
});

test("buildFeed keeps stretch items when nothing else is left", () => {
  const pillars = Object.keys(TAGS) as Pillar[];
  const inside = Array.from({ length: 20 }, (_, i) =>
    item(`r${i}`, { pillar: pillars[i % 4], tags: [TAGS[pillars[i % 4]][i % 3]], level: 20 }));
  const stretch = [25, 26, 27, 28].map((level, i) =>
    item(`s${i}`, { pillar: pillars[i], tags: [TAGS[pillars[i]][0]], level, friendsEngaged: 3 }));
  const feed = buildFeed([...inside, ...stretch], user({ level: 20 }), { now: NOW, random: () => 0 });
  assert.equal(feed.length, 24);
  // The cap holds while in-window items remain.
  const lastInside = Math.max(...inside.map((c) => feed.indexOf(c)));
  for (let p = 0; p <= lastInside; p += 10) {
    assert.ok(feed.slice(p, Math.min(p + 10, lastInside + 1)).filter((c) => c.level > 24).length <= 1, `page ${p / 10}`);
  }
});

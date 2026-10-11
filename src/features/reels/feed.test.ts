import assert from "node:assert/strict";
import test from "node:test";
import { TAGS, PILLARS, LANGUAGES } from "../../shared/types.ts";
import rows from "./data/reels.json" with { type: "json" };
import { SESSION_LIMIT, quizReels, seededRandom, sessionFeed } from "./feed.ts";

test("quizReels opens the gate at 5 views", () => {
  assert.equal(quizReels(["a", "b", "c", "d"]), null);
  assert.deepEqual(quizReels(["a", "b", "c", "d", "e", "f"]), ["a", "b", "c", "d", "e"]);
});

test("sessionFeed keeps the 30-reel limit and puts a shared reel first", () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}` }));
  const ids = (f: { items: { id: string }[] }) => f.items.map((r) => r.id);
  const fresh = sessionFeed(items, []);
  assert.equal(fresh.items.length, SESSION_LIMIT);
  assert.equal(fresh.stop, true);
  const back = sessionFeed(items.slice(5), ["r0", "r1", "r2", "r3", "r4"]);
  assert.equal(back.items[0].id, "r5");
  assert.equal(back.items.length, SESSION_LIMIT - 5);
  assert.deepEqual(ids(sessionFeed(items.slice(1, 3), ["r0"], items[0])), ["r0", "r1", "r2"]);
  assert.deepEqual(ids(sessionFeed(items.slice(0, 3), [], items[2])), ["r2", "r0", "r1"]);
  assert.deepEqual(sessionFeed([], ["r0", "r1", "r2"]), { items: [], stop: false });
  assert.deepEqual(sessionFeed(items, items.slice(0, SESSION_LIMIT).map((r) => r.id)), { items: [], stop: true });
});

test("seededRandom repeats for the same seed", () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  const xs = [a(), a(), a()];
  assert.deepEqual([b(), b(), b()], xs);
  for (const x of xs) assert.ok(x >= 0 && x < 1);
  assert.notEqual(seededRandom(43)(), xs[0]);
});

test("manifest rows are valid", () => {
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.id}.${r.language}`;
    assert.ok(!seen.has(key), `duplicate ${key}`);
    seen.add(key);
    assert.ok((PILLARS as readonly string[]).includes(r.pillar), `${r.id} pillar`);
    assert.ok((LANGUAGES as readonly string[]).includes(r.language), `${r.id} language`);
    assert.ok(r.id.startsWith(`${r.pillar}-`), `${r.id} id starts with its pillar`);
    // A clip in the bucket's folder for its language, or an English clip under translated captions.
    const folder = { en: "English", hi: "Hindi", te: "Telugu" }[r.language as "en" | "hi" | "te"];
    assert.ok(/^[A-Za-z]+\/[^/]+\.mp4$/.test(r.file) && [folder, "English"].includes(r.file.split("/")[0]), `${r.id} file`);
    assert.ok(r.tags.length >= 1 && r.tags.length <= 3, `${r.id} has 1–3 tags`);
    const allTags = Object.values(TAGS).flat() as string[];
    for (const t of r.tags) assert.ok(allTags.includes(t), `${r.id} tag ${t}`);
    assert.ok(Number.isInteger(r.level) && r.level >= 1 && r.level <= 99, `${r.id} level`);
    assert.ok(!Number.isNaN(Date.parse(r.createdAt)), `${r.id} createdAt`);
  }
});

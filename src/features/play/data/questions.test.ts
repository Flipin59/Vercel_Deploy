// Checks the question bank against QUESTIONS.md §2–3 and §8, and its reel/chapter
// links against the Reels and Learn manifests (read as data, not imported).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { PILLARS, TAGS, TIERS } from "../../../shared/types.ts";

const dir = new URL("./questions/", import.meta.url);
const read = (url: URL) => JSON.parse(readFileSync(url, "utf8"));
const questions = readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) => read(new URL(f, dir)));
const reelIds: string[] = read(new URL("../../reels/data/reels.json", import.meta.url)).map((r: { id: string }) => r.id);
const chapterSlugs: string[] = read(new URL("../../learn/data/chapters.json", import.meta.url)).map((c: { slug: string }) => c.slug);

test("every question is well-formed", () => {
  const ids = new Set<string>();
  for (const q of questions) {
    const at = q.id;
    assert.ok(!ids.has(q.id), `duplicate ${at}`);
    ids.add(q.id);
    assert.ok(PILLARS.includes(q.pillar) && q.id.startsWith(`${q.pillar}-`), `pillar ${at}`);
    assert.ok(q.tags.length >= 1 && q.tags.length <= 3, `tag count ${at}`);
    for (const tag of q.tags) assert.ok((TAGS[q.pillar as keyof typeof TAGS] as readonly string[]).includes(tag), `tag ${tag} ${at}`);
    assert.ok(TIERS.includes(q.tier), `tier ${at}`);
    assert.equal(q.type, "mcq", `type ${at}`);
    assert.ok(["draft", "live", "retired"].includes(q.status), `status ${at}`);
    assert.ok(["human", "ai"].includes(q.source), `source ${at}`);
    if (q.reel_id && q.status !== "retired") assert.ok(reelIds.includes(q.reel_id), `reel ${at}`);
    if (q.chapter_slug) assert.ok(chapterSlugs.includes(q.chapter_slug), `chapter ${at}`);
    const en = q.content.en;
    assert.ok(en?.prompt && en.explanation, `text ${at}`);
    assert.equal(en.options.length, 4, `options ${at}`);
    assert.ok(["A", "B", "C", "D"].includes(en.answer), `answer ${at}`);
  }
});

test("each reel has at most one linked question and each chapter 5–8", () => {
  // Reel quizzes top up from the reel's tags, so a reel without its own question still works.
  for (const id of reelIds) assert.ok(questions.filter((q) => q.reel_id === id && q.status !== "retired").length <= 1, id);
  for (const slug of chapterSlugs) {
    const n = questions.filter((q) => q.chapter_slug === slug).length;
    assert.ok(n >= 5 && n <= 8, `${slug}: ${n}`);
  }
});

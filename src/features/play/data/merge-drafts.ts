// Merges checked translation drafts (questions/drafts/<pillar>.<lang>.json) into the bank
// as content.<lang> (QUESTIONS.md §8). Run once a language's drafts are ready to go live,
// then regenerate the seed (seed.ts):
//   node --experimental-strip-types src/features/play/data/merge-drafts.ts hi
// A draft whose answer letter or option count differs from the English question is refused.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const lang = process.argv[2];
if (lang !== "te" && lang !== "hi") throw new Error("Usage: merge-drafts.ts <te|hi>");
const dir = new URL("./questions/", import.meta.url);
type Draft = { id: string; prompt: string; options: string[]; answer: string; explanation: string };

let merged = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const drafts: Draft[] = JSON.parse(readFileSync(new URL(`drafts/${file.replace(".json", `.${lang}.json`)}`, dir), "utf8"));
  const bank = JSON.parse(readFileSync(new URL(file, dir), "utf8"));
  for (const q of bank) {
    const d = drafts.find((x) => x.id === q.id);
    if (!d) continue;
    const { prompt, options, answer, explanation } = d;
    if (answer !== q.content.en.answer || options.length !== q.content.en.options.length || !prompt || !explanation) {
      throw new Error(`Draft ${q.id}.${lang} doesn't match the English question`);
    }
    q.content[lang] = { prompt, options, answer, explanation };
    merged++;
  }
  writeFileSync(new URL(file, dir), `${JSON.stringify(bank, null, 2)}\n`);
}
console.log(`Merged ${merged} ${lang} questions`);

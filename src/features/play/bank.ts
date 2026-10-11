// The question bank as served without Supabase (local demo): the JSON files' live
// questions. With Supabase, play_questions is the source (seeded from the same JSON).
import budget from "./data/questions/budget.json";
import invest from "./data/questions/invest.json";
import safety from "./data/questions/safety.json";
import save from "./data/questions/save.json";
import type { BankQuestion } from "./engine";

export const DEMO_BANK = [...budget, ...save, ...invest, ...safety].filter((q) => q.status === "live") as BankQuestion[];
export const BANK_COLUMNS = "id, pillar, tags, tier, type, content, reel_id, chapter_slug, answers_count";

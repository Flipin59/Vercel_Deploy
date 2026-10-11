// The reel manifest (data/reels.json), typed. Pure: safe in server and client code.
// The `reels_items` table is seeded from the same rows; keep them in step.
import type { Language, Pillar, Tag } from "@/shared/types";
import rows from "./data/reels.json";

export type Reel = {
  id: string;
  language: Language;
  file: string; // path in the `reels` Storage bucket: "<English|Hindi|Telugu>/<name>.mp4"
  title: string;
  captions: string;
  hashtags: string[];
  pillar: Pillar;
  tags: Tag[];
  level: number;
  chapter: string | null; // learn slug for "Go to chapter"
  createdAt: string;
};

export const REELS = rows as Reel[];

export function getReel(id: string, language: Language = "en"): Reel | undefined {
  return REELS.find((r) => r.id === id && r.language === language) ?? REELS.find((r) => r.id === id);
}

// The student's language first; English for reels not made in it yet.
export function reelsForLanguage(language: Language): Reel[] {
  const own = REELS.filter((r) => r.language === language);
  const have = new Set(own.map((r) => r.id));
  const fallback = REELS.filter((r) => r.language === "en" && !have.has(r.id));
  return [...own, ...fallback];
}

import type { Pillar, Tag } from "@/shared/types";
import data from "./data/chapters.json";

// One manga chapter (L1 manifest). Its title is "chapter.<slug>" in messages/*.json, and its
// pages are rendered from contents/pdfs/<slug>.<lang>.pdf by contents/pdfs/render.sh.
export type Chapter = {
  slug: string;
  pillar: Pillar;
  tags: Tag[];
  level: number;
  requires: string[];
  createdAt: string;
};

export const CHAPTERS = data as Chapter[];

// Stable URL other features link to (Reels "Learn more", forum).
export const chapterHref = (slug: string) => `/learn/${slug}`;

// Fills "{name}" placeholders in a translated string.
export const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

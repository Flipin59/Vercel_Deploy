// Public API of the learn feature, safe to import from server and client code.
// Pages: /learn (library) and /learn/<slug> (reader); link to chapters with chapterHref().
import type { Language } from "@/shared/types";
import en from "./messages/en.json";
import hi from "./messages/hi.json";
import te from "./messages/te.json";

export { CHAPTERS, chapterHref, type Chapter } from "./chapters";

// A chapter's title in a language (English if it isn't translated), for other features'
// links, e.g. the forum's "Discuss this chapter" draft.
export function chapterTitle(slug: string, language: Language): string {
  const titles: Record<Language, Record<string, string>> = { en, te, hi };
  return titles[language][`chapter.${slug}`] ?? titles.en[`chapter.${slug}`] ?? slug;
}

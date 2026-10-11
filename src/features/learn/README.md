# Manga lessons — Saikiran S

**You own:** `src/features/learn/`, `src/app/(app)/learn/`, `contents/pdfs/`, `supabase/migrations/*_learn_*.sql`, tables prefixed `learn_`.

## Goal
The deep-dive layer: manga-style PDFs that explain each topic properly. This brief is the code — a library and a reader for whatever lands in `contents/pdfs/`.

## Scope
- Library screen: chapters grouped by the four pillars, with progress per chapter.
- A chapter manifest (JSON file or `learn_` table): slug, title, PDF file, pillar, language. Use placeholder PDFs until real ones exist.
- Reader: renders the PDF page by page, fast on a cheap phone, swipe between pages, remembers the last page.
- A 5-question check at the end of each chapter, through the shared quiz screen (QUIZ.md). The chapter bonus is awarded on the server (IMPLEMENTATION.md §6).
- Chapters are never locked (RECOMMENDATION.md §5).
- Pick the chapter variant matching the student's language.

## Contracts
- User: `getCurrentProfile()` from `@/shared/session`.
- Progress: `recordActivity({ source: "learn", kind: "chapter_finished", pillar, xp })`.
- Strings: `useT({ en, te, hi })` with your `messages/*.json`.
- Keep chapter URLs stable (`/learn/<chapter-slug>`) so reels and the forum can link to them.

## How it works (Wave 1)
- **Chapters:** `data/chapters.json` (slug, pillar, tags, level, requires, createdAt). Titles are `chapter.<slug>` in `messages/*.json`. No `learn_chapters` table — the manifest is versioned with the code.
- **Adding a chapter:** drop `contents/pdfs/<slug>.<lang>.pdf`, run `contents/pdfs/render.sh` (needs `pdftoppm`), commit the PDF and `contents/pdfs/pages/<slug>.<lang>/`. Missing languages fall back to English.
- **Reader** (`/learn/<slug>`): pre-rendered 720 px JPEG pages in a CSS scroll-snap strip, served by `/learn/<slug>/pages/<lang>/<n>`. Progress goes to `learn_progress` (opened, last page, finished on the last page) and is skipped while Supabase isn't configured.
- **Library** (`/learn`): Recommended (bubbles sized by Play's `scoreItem`), Continue reading, all chapters by pillar, with search.
- **For other features:** `import { CHAPTERS, chapterHref } from "@/features/learn"`.

## Decisions (Wave 3a, 2026-10-11)
- **Chapter bonus (W3-L1, W3-L3):** +10 XP once per chapter when the check is ≥ 60% of 5 questions (not of the questions served) *and* the student has reached the chapter's last page (`learn_progress.finished_at`). The reader says whether the bonus was earned now, earned before, missed, needs reading first, or failed to save (reloading retries). A failed award no longer breaks the page.
- **Retakes (W3-P6):** only the student's first check of a chapter may earn the bonus: `firstCheck` from Play's `getAttemptResult` is false once anything was answered in an earlier check (so revealing answers and quitting doesn't buy a free retake). A check taken before reading the chapter counts as that first check, so it uses up the bonus; the reader only offers the check on the last page.
- **tagInterest (W3-L2):** chapters use only finished chapters, not reel likes/saves/skips — a deliberate deviation from RECOMMENDATION.md §3.
- **Language (W3-L2):** te/hi students see the English chapter until a translated PDF exists (an exception to RECOMMENDATION.md §8's same-language rule, like Reels').
- **Translations (C4):** `messages/te.json` and `hi.json` are Claude drafts; a Telugu and a Hindi speaker check them before merging.

## Stretch
- Download button per chapter for offline / classroom use by NGOs.
- "Discuss this chapter" link into the forum.

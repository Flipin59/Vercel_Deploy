# Reels — Nagamalla Sai Abhinav

**You own:** `src/features/reels/`, `src/app/(app)/reels/`, `contents/reels/`, `supabase/migrations/*_reels_*.sql`, tables prefixed `reels_`.

## Goal
A vertical, swipeable feed of short "brainrot-style" clips that each teach one financial idea in under a minute.

How the reel scripts and videos get made is a team decision still to come. This brief is the code: a player that plays whatever lands in `contents/reels/`.

## Scope
- Full-screen vertical feed with scroll-snap, one reel per screen.
- Autoplay the visible reel, pause the rest, mute toggle, preload only the next one (slow connections).
- A reel manifest (JSON file or `reels_` table): id, video file, captions, pillar (`Pillar` in `src/shared/types.ts`), language. Use placeholder clips until real ones exist.
- Like / save / share.
- After every 5 reels, a 3-question quiz on those reels (QUIZ.md, QUESTIONS.md §6). Scrolling stays locked until it's done, and it is waiting if the student leaves and comes back.
- Filter the feed by the student's language.

## Contracts
- User: `getCurrentProfile()` from `@/shared/session`.
- Progress: call `recordActivity({ source: "reels", kind: "reel_watched", pillar, xp })`.
- Strings: `useT({ en, te, hi })` with your `messages/*.json`.

## Stretch
- Feed order adapts to the student's persona and weak pillars. **Built (Wave 3b):** `RecUser.persona` and the friends count from `reels_friends_engaged()` are passed to Play's `buildFeed`.
- "Learn more" button deep-linking to a manga chapter (`/learn/<chapter-slug>` — agree the slug with Saikiran).

## How it is wired (Wave 1)
- **Manifest:** `data/reels.json` (typed in `manifest.ts`), one row per reel per language. The `reels_items` table holds the same rows (latest: `supabase/migrations/20261011220000_reels_bucket_clips.sql`); change both together.
- **Clips:** in the public `reels` Supabase Storage bucket, one folder per language (`English/`, `Hindi/`, later `Telugu/`). A row's `file` is the path in the bucket, e.g. `English/banking.mp4`; the feed plays `<SUPABASE_URL>/storage/v1/object/public/reels/<file>` (range requests work, the CDN caches them). Upload with the dashboard (Storage → reels) or `npx supabase storage cp --experimental <local> ss:///reels/<folder>/<name>`. Clips are never committed. A Hindi row with the same `id` as an English one is that reel's Hindi version; students see their language first, then English reels that have no version in it. Encode clips vertical, 720p or lower, H.264 + `-movflags +faststart`. Without Supabase, `contents/reels/make-placeholders.sh` writes placeholders to `public/media/reels/<file>` (git-ignored).
- **Engagement:** `reels_events` (view ≥ 3 s, skip < 3 s, complete ≥ 80%, like/unlike, save/unsave, share) and `reels_reactions` (current like/save). Totals for other features: `reels_item_stats(since)`.
- **XP:** a completed view gives 1 XP `reel_watched`, once per reel ever (`ref: reel_watched:<id>`).
- **Quiz gate:** distinct views since the student last *finished* a reel quiz (Play's `getLastFinishedAt("reel")`) are counted on the server; at 5 the feed stops at a quiz card that opens `quizHref({ context: "reel", reelIds, returnTo: "/reels" })`.
- **Session:** reels shown in this tab are kept in `sessionStorage` (`reels.seen`), so returning from the quiz continues the feed and the 30-reel stop counts the whole session.
- **Feed order (W3-R2):** the server loads candidates (minus reels completed in the last 30 days) and the student's `RecUser`; `ReelsFeed` drops this tab's seen reels and *then* calls Play's `buildFeed`, with a seed and `now` from the server so the server and browser render the same order. Tag interest takes likes/saves from current `reels_reactions` (liked in the last 14 days), so toggling doesn't count twice. `reels_item_stats` returns all-time `likes` for the counter and `recent_likes`/`recent_saves` (30 days) for popularity.


Wave 2 Dashboard contract (Praveen integration, approved):
`getContinueReelHref()` from `@/features/reels/server` is server-only and derives
its user from `getCurrentProfile()`. It returns `reelHref(id)` for the latest view
of an available reel in the student's current language (including the manifest's
English fallback), or `/reels` with no history, no database, or a read failure.
Dashboard never queries Reels tables directly.

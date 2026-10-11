# Dashboard — Sashwat Balaji

**You own:** `src/features/dashboard/`, `src/app/(app)/dashboard/`.

## Goal
The home screen: what have I done, how am I doing, what should I do next.

## Scope
- Level, title, progress, skill rating, coins and daily streak, derived from the `xp_events` ledger (read-only — only `recordActivity()` writes to it). Shown only to the student (RATING.md §7).
- Progress per pillar.
- Friends and how they are doing (from your own `getFriends()` in the forum feature).
- "Continue" shortcuts into Reels, Play and Learn.
- Leaderboard with Friends and Global tabs, ranked by XP from the last 7 days, showing rank, username and title only (RATING.md §7).

## Contracts
- User: `getCurrentProfile()` from `@/shared/session`.
- If you need a new query over `xp_events`, add it under `src/features/dashboard/`; if you need a schema change, ask Praveen.

## Stretch
- Badges and weekly goals (no coin rewards — coins are defined only in QUIZ.md).


## Wave 2 integration (Praveen, approved scope)

D3 loads Friends/Global through `getLeaderboard`, using IDs only from Forum's
`getFriends`. Tabs display rank, username and title; the student's own rank is
shown separately when outside the top 50. Empty results and load errors have
separate messages. D4 links to the most recently updated unfinished known chapter,
Reels' `getContinueReelHref()`, and `/play`. With no reading/watch history, links
open `/learn` or `/reels`. Existing D1/D2 visuals remain in place, with an Edit
profile link below the profile card.

# Play & duels — Sanjith Ganapathi

**You own:** `src/features/play/`, `src/app/(app)/play/`, `supabase/migrations/*_play_*.sql`, tables prefixed `play_`.

## Goal
The "learn by doing" core: students make money choices, see consequences, and try again — alone or against a friend.

## Scope
- At least one solo simulation (e.g. survive a month on a budget, grow savings over years, spot the scam).
- 1v1 duel mode: matchmaking by skill rating or invite-a-friend, 30 s fastest-finger rounds decided on the server (SCORE.md §4), a result screen. Supabase Realtime (broadcast + presence) carries the display; the database decides who was first.
- Question / scenario bank tagged by pillar and difficulty.
- The quiz screen every feature uses, with coins and reattempts (QUIZ.md).
- Skill rating (RATING.md §10, SCORE.md §8): drives question difficulty and matchmaking.
- Bot opponent fallback so a duel always works in the demo.

## Contracts
- User: `getCurrentProfile()` from `@/shared/session`.
- Progress: `recordActivity({ source: "play", kind: "duel_won" | "sim_completed" | ..., pillar, xp })`.
- Strings: `useT({ en, te, hi })` with your `messages/*.json`.

## Stretch
- More simulations.


Wave 2 Auth integration (Praveen, approved): server-only `getPlacementAttempt()`
returns only the current student's placement ID, question IDs, answered IDs and
correct count. `pickQuestions({ context: "placement" })` reuses that attempt and
serves only unanswered questions, preserving stored order. A concurrent insert
conflict also resumes the existing attempt. Quiz links return to `/onboarding`
without prefetch so the final placement summary is fresh. No scoring, coin or
rating rules changed.

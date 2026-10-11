@AGENTS.md

# FinQuest

Financial-literacy web app for Grades 11–12 students (Vanguard problem statement, `Vanguard-ps.pdf`). Five people work in parallel, each in their own feature directory.

## Before writing code

1. Ask the user which feature they own if it is not obvious, then read `docs/TEAM.md` and that feature's `src/features/<feature>/README.md`.
2. Read `IMPLEMENTATION.md` §0 (settled decisions), §4 (rules for every module) and §6 (XP/coin integrity), and find your module ID in §1. Anything touching the quiz or coins: `src/features/play/docs/QUIZ.md`.
3. Only create or edit files inside the owner's directories listed in `docs/TEAM.md`. Do not touch `src/shared/`, root config, `package.json` or another feature's folder unless the user is the platform owner — say what change is needed instead.

## Conventions

- Next.js App Router, TypeScript, Tailwind v4. Route files in `src/app/(app)/<feature>/` stay thin and render components from `src/features/<feature>/`.
- Signed-in user: `getCurrentProfile()` from `@/shared/session`. XP, coins and rating: `recordActivity()` from `@/shared/progress`, from server code only, with amounts the server works out itself. Never write to `xp_events` or `profiles` from a feature.
- Feature files: `index.tsx` is safe to import anywhere (components, pure functions, types, re-exported actions); `actions.ts` is the `"use server"` file (every export is a public endpoint — take the user from the session, never trust amounts or results from the client); `server.ts` holds server-only helpers other features call (not a server action). Other features import only from `index.tsx` or `server.ts`.
- Levels, titles and skill rating only via `@/shared/rating`; shared types (`Pillar`, `Tier`, `TAGS`, ...) from `@/shared/types`.
- Which doc wins on which topic: the table in `docs/TEAM.md`. Coins: only `src/features/play/docs/QUIZ.md`.
- Supabase clients: `@/shared/supabase/client` (Client Components) and `@/shared/supabase/server` (server code).
- User-facing strings go in the feature's `messages/{en,te,hi}.json` and are read with `useT` from `@/shared/i18n`.
- Videos, PDFs and audio live in `contents/` (see `contents/README.md`), not in feature folders.
- Database tables are prefixed with the feature name; migrations are new files named `supabase/migrations/<YYYYMMDDHHMMSS>_<feature>_<what>.sql`.
- Content must educate, not recommend investments; simulations state assumptions. Users are minors — collect and show minimal personal data.
- Mobile-first: target a 360px-wide low-end Android phone.

## Commands

- `npm run dev` — dev server on :3000
- `npm run build` — must pass before a PR is merged
- `npm run lint`
- `npm run test` — `node --test` over `src/**/*.test.ts`; pure logic (scoring, selection, feeds) gets a test next to it

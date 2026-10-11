# Team, ownership and rules

Problem statement: `Vanguard-ps.pdf` — a financial-literacy experience for Grades 11–12 students from underserved communities in Hyderabad.

## Who owns what

| Person | Area | Directories | Branch |
| --- | --- | --- | --- |
| Praveen V | Auth, onboarding, platform, integration | `src/features/auth`, `src/app/(auth)`, `src/shared`, root config | `feat/auth` |
| Nagamalla Sai Abhinav | Reels | `src/features/reels`, `src/app/(app)/reels`, `contents/reels` | `feat/reels` |
| Sanjith Ganapathi | Play & duels | `src/features/play`, `src/app/(app)/play` | `feat/play` |
| Saikiran S | Manga lessons | `src/features/learn`, `src/app/(app)/learn`, `contents/pdfs` | `feat/learn` |
| Sashwat Balaji | Forum, friends, dashboard | `src/features/forum`, `src/features/dashboard`, `src/app/(app)/forum`, `src/app/(app)/dashboard` | `feat/forum` |

Each feature directory has a `README.md` with the task brief. To swap people, change this table, the README titles and `.github/CODEOWNERS`.

## Which doc decides what

When two docs disagree, the one listed for that topic wins. `deliverables/M1.pdf` is a submitted snapshot and is not updated; where it differs from these docs, the docs win.

| Topic | Source of truth |
| --- | --- |
| Ownership and team rules | `docs/TEAM.md` |
| Feature scope | `src/features/<feature>/README.md` |
| Quiz screen, reattempts and **all coin amounts** | `src/features/play/docs/QUIZ.md` |
| XP amounts and rating changes | `src/features/play/docs/SCORE.md` |
| Levels, titles, skill rating, leaderboards, who sees what | `src/features/play/docs/RATING.md` |
| Question bank and which questions a quiz shows | `src/features/play/docs/QUESTIONS.md` |
| Reel and chapter recommendations, duel matchmaking | `src/features/play/docs/RECOMMENDATION.md` |
| Screen layouts | `UI.md` (behaviour defers to the docs above) |
| Build order, contracts, XP/coin integrity | `IMPLEMENTATION.md` |

## Rules that keep us from clashing

1. **Stay in your directories.** Your feature folder, your route folder, your part of `contents/` (see `contents/README.md`), your migrations. Everything else is someone else's.
2. **`src/shared/` and root files belong to Praveen.** Need something changed there (a dependency, a shared type, a design token)? Ask in the chat; he makes the change on `main` and everyone pulls. This is the only place merge conflicts can realistically come from, so it has one owner.
3. **Features talk through three functions only**, all already stubbed so nobody is blocked:
   - `getCurrentProfile()` — `@/shared/session`
   - `recordActivity(event)` — `@/shared/progress`
   - `useT({ en, te, hi })` — `@/shared/i18n`
4. **Importing another feature:** only from its `index.tsx` (safe in both server and client code: pure functions, server actions, types) or its `server.ts` (server-only helpers such as `getFriends`), never from other internals. Linking to another feature by URL is always fine — the quiz is opened that way, with `quizHref()`.
5. **Database:** tables are prefixed with the feature name (`reels_`, `play_`, `learn_`, `forum_`). One migration file per change, `supabase/migrations/<YYYYMMDDHHMMSS>_<feature>_<what>.sql`. Never edit a migration that is already on `main`.
6. **New npm packages:** `package.json` and `package-lock.json` are the one shared file everyone is tempted to touch. Post the package name in the chat, Praveen installs it on `main`, you pull.
7. **Git:** work on your branch, rebase on `main` often (`git pull --rebase origin main`), open small PRs. `npm run build` must pass before merging.

## Product rules from the problem statement

- **Educate, never recommend.** No "buy this fund/stock". Simulations state their assumptions and are not promises.
- **Privacy-conscious.** Users are minors: collect the minimum (email, username, language, grade). No real names, phone numbers, schools or cities, anywhere. Other students see only a username and title (`RATING.md` §7).
- **XP, coins and rating are written only by server code** through `recordActivity()`. Students can read only their own totals and can never add XP themselves (`IMPLEMENTATION.md` §6).
- **Mobile-first.** Design for a 360px-wide budget Android phone on a slow connection; the app shell is capped at `max-w-md`.
- **Language-ready.** No hard-coded user-facing strings; use `useT` and your `messages/*.json` (English, Telugu, Hindi).
- **Tag everything with a pillar:** `budget`, `save`, `invest`, `safety` (`Pillar` in `src/shared/types.ts`).

# Auth, onboarding & platform — Praveen V

**You own:** `src/features/auth/`, `src/app/(auth)/`, `src/shared/`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(app)/layout.tsx`, `supabase/migrations/*_core_*.sql`, root config, deployment.

## Goal
Get a student from the landing page to a personalised app in under a minute, and keep the shared plumbing working for the other four.

## Scope
- Sign-up with email, username and password (Supabase Auth sends one email-verification link; it may be switched off in the demo project), sign-in with email and password, sign-out.
- Onboarding: language preference, grade, a few questions that set a starting persona (problem statement: "persona-led"), and the optional placement quiz (RATING.md §4).
- Daily login bonus: +10 coins on the first visit each IST day (QUIZ.md §6), recorded on the server.
- Profile page to edit the above. Language choice must drive `LanguageProvider` in `src/shared/i18n`.
- Route protection for everything under `(app)`.
- Make the two shared stubs real **without changing their signatures**:
  - `getCurrentProfile()` in `src/shared/session.ts`
  - `recordActivity()` in `src/shared/progress/` → server-only, writes XP, coins and rating to `xp_events`. Students must not be able to insert rows or read anyone else's (IMPLEMENTATION.md §6)
- Supabase project, env vars, Vercel deploy, merging PRs.

## Do first (unblocks everyone)
1. Create the Supabase project, run `supabase/migrations/20261010000000_core.sql`, share the env values.
2. Deploy the stub app to Vercel so the team has a live URL.

## Stretch
- NGO / teacher view of cohort progress ("NGO-integrated"). **Built (Wave 3b):** an admin marks an account in SQL (`update profiles set role = 'teacher' where username = '…';` — or `'mentor'` for an NGO volunteer; students can't change `role`). A teacher creates classes at `/cohort` and shares the 6-character code; students join or leave on `/profile` (one class per student). The teacher sees each member's username, title, level and XP (7 days, per pillar) and nothing else.
- PWA install + offline shell for low-end phones. **Built (Wave 3b):** `src/app/manifest.ts`, `public/sw.js` (registered in production only) and `public/offline.html`. Pages and data are never cached, so XP and coins are never stale.

## Wave 1 implementation (2026-10-11)

Implemented A1/A2 and platform S3/S4/S8: email/password auth, PKCE verification
callback, sign-out, Next 16 cookie-refresh proxy, onboarding, session lookup,
server-only activity recording, private summaries and leaderboards. The app
layout awards 10 daily-login coins once per IST date. No Supabase public env
values means a non-persistent demo; partially configured env fails closed.

Setup before testing against Supabase:

1. Apply `20261010000000_core.sql`, then
   `20261011010000_core_wave1.sql`. The new migration creates profiles via an
   `auth.users` insert trigger. Existing accounts must already have a profile;
   missing profiles are surfaced as an error rather than replaced with demo data.
2. Set the values in `.env.example`, including the server-only service-role key
   and trusted `SITE_URL`. Allow `<SITE_URL>/auth/callback` in Supabase Auth's
   redirect URL configuration. Keep the standard confirmation template using
   `ConfirmationURL`. The PKCE link must be opened in the browser used to sign up;
   after confirmation elsewhere, the student can return and sign in.
3. With Node 22+, run `npm run build`, `npm run lint`, and `npm run test`.
4. Test sign-up with verification both enabled and disabled, sign-in/out,
   signed-out access to each app route, onboarding persistence, and repeat app
   visits (only one daily bonus). Use two accounts to verify private data stays
   private. Run `supabase/tests/core_wave1.sql` on a disposable database; it checks
   RPC grants, RLS, idempotency, insufficient funds, the rating floor and the
   onboarding guard inside a rolled-back transaction. Concurrent duplicate award
   and wager requests still need a live integration check.

Profile reads now allow only the student's own row, including language, grade
and persona. Other features must use server-only helpers for public username/title
projections; do not expose profile or ledger rows in client endpoints.
`getLeaderboard('friends', ids)` expects IDs from Forum's trusted `getFriends`
helper, never caller-submitted IDs. It returns the top 50 plus the student's own
rank separately; equal weekly XP shares a rank.

Persona answers store initial need per pillar: new = 1, learning = 0.6,
confident = 0.2. These are onboarding preferences, not XP or skill-rating awards.
English fallback strings are present in Telugu/Hindi catalogs pending Wave 3.
A3 placement and A4 profile editing are implemented in Wave 2 as described below.
Onboarding completion permanently closes placement eligibility.

Local checks: targeted ESLint passed; 6 new validation/date tests and 3 existing
rating tests passed after temporary TypeScript transpilation for the available
Node 18 runtime. Full `tsc --noEmit --incremental false` currently stops on the
existing Play quiz route's missing generated `PageProps`. No package install,
Next build/dev server, database migration or browser integration test was run.


Wave 1 re-audit: every item in the Platform row of IMPLEMENTATION.md §3 has a
code implementation (A1, A2, S3, S4, S8). The proxy matcher now includes URLs with
file-like suffixes under protected routes. A temporary local harness checked the
actual progress module with mocked session/RPC dependencies: signed-out and
cross-user denial, session-derived award identity, invalid award rejection,
RPC error propagation, summary conversion, private leaderboard projections,
top-50 plus own rank, friends scope and demo no-write behavior. Next's installed
matcher utility confirmed coverage for every current app route, onboarding,
the email callback and a `/learn/lesson.pdf` path. These checks passed, as did
targeted lint; they do not replace the outstanding live database/browser checks.


## Wave 2: placement and profile

- Onboarding saves language, grade and persona before opening the shared placement
  quiz with `quizHref`. Only the placement quiz may bypass unfinished onboarding;
  Proxy derives and overwrites the layout's routing header from the actual URL.
- An interrupted quiz resumes only unanswered questions from the same attempt.
  That resumed quiz screen summarizes the remaining questions; onboarding shows
  the whole attempt's answered/correct totals. The existing unique attempt index
  and ledger references remain in force. Finishing onboarding, or choosing Skip,
  sets `onboarded_at` and closes further placement submissions. A completed
  placement returns to onboarding for the final Start learning button.
- `/profile`, linked from Dashboard, updates only the signed-in student's language
  and grade. Root-layout revalidation updates LanguageProvider after a successful
  save; failed saves do not change the active language.
- Cross-feature integration: Play (Sanjith) adds server-only
  `getPlacementAttempt()` and resumes placement through the existing
  `pickQuestions` signature. Dashboard (Sashwat) adds the profile link and Reels
  (Sai Abhinav) exposes a server-only Continue URL helper. These were approved as
  part of Praveen's A3/A4/D3/D4 scope.

Verification: TypeScript, targeted ESLint and all 39 Node tests passed. A local
mocked integration harness checked the actual auth actions, proxy, placement
resume, Continue helper and dashboard loader. No build/dev command or live
Supabase mutation was run. With the existing migrations and question seed applied,
manually check: new sign-up → placement → refresh halfway → resume → finish;
new sign-up → skip; direct non-placement navigation before onboarding; profile
language/grade save; both leaderboard tabs including own rank outside the top 50;
and last-reel/latest-unfinished-chapter links. No database changes are required.

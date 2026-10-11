# Wave 3a demo setup and walkthrough

## Supabase setup (hosted project)

Run from the repo root with Node 22. The CLI is a dev dependency (`npx supabase`);
its config is `supabase/config.toml` (used by the local stack and `db push --include-seed`).

1. **Project:** create one at supabase.com (region Mumbai, `ap-south-1`). Note the
   project ref (the `xxxx` in `https://xxxx.supabase.co`) and the database password.
2. **Keys → `.env.local`** (copy `.env.example`; Project Settings → API / API keys):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (server only, never `NEXT_PUBLIC_`), `SITE_URL=http://localhost:3000`. Optional:
   `GOOGLE_TRANSLATE_API_KEY` for forum translation.
3. **Auth** (Authentication → URL Configuration): Site URL = your `SITE_URL`; add
   `<SITE_URL>/auth/callback` to Redirect URLs (localhost and the Vercel URL). For the
   demo you may turn off "Confirm email" (Authentication → Sign In / Providers → Email).
4. **Link and check history:**
   `npx supabase login`, then `npx supabase link --project-ref <ref>` (asks for the DB
   password), then `npx supabase migration list`.
   - Remote column empty and the Table Editor empty → go to step 5.
   - Remote column empty but tables exist (someone pasted SQL by hand) or versions
     that aren't in `supabase/migrations/` (e.g. an old `20261011140000_forum_accept_reply`)
     → the history doesn't match. On a demo project with no real users, wipe and rebuild:
     `npx supabase db reset --linked` (deletes all data, applies every migration and the
     seed). Otherwise ask Praveen before using `npx supabase migration repair`.
5. **Apply:** `npx supabase db push --dry-run` (lists what will run), then
   `npx supabase db push --include-seed` (all migrations in order, then the 8 fixture
   students from `supabase/seed.sql`). Later migrations: `npx supabase db push`.
6. **Optional checks:** paste `supabase/tests/core_wave1.sql` and `core_wave3a.sql` into
   the SQL Editor; each rolls back and raises an error only if something is wrong.
7. **Run:** `npm run dev`, sign up at `http://localhost:3000`, go through the walkthrough
   below. **Vercel:** set the same variables for Production *and* the build (with
   `SITE_URL` = the Vercel URL), then redeploy. **Always push migrations before deploying
   code that needs them:** e.g. the session reads `profiles.role`, so code deployed before
   `20261011192000_core_roles_cohorts` is applied returns a 500 on every page.

**Local stack instead (needs Docker):** `npx supabase start` prints a local URL and keys
for `.env.local`; `npx supabase db reset` applies migrations and the seed; Studio is at
`http://localhost:54323` and sign-up emails land in `http://localhost:54324`.

## Walkthrough

Use a disposable Supabase project. Apply every SQL migration in filename order,
then `supabase/seed.sql`. The seed creates eight synthetic students with eight IST
days of quiz history and friendships. These fixture accounts cannot sign in;
create the demonstration account using the normal sign-up screen.

Migration repair: `forum_accept_reply` now has version `20261011140001`, distinct
from `20261011140000_core_public_profiles`. If the old duplicate version has
already been applied remotely, inspect Supabase's migration history before using
an automated migration push. The renamed SQL has no content changes. The new
`20261011160000_core_reply_policy.sql` must also run to remove the unsafe policy.

Configure the `.env.example` variables locally and on Vercel for both build and
runtime: Supabase URL, anon key, service-role key and trusted `SITE_URL`. Allow
`<SITE_URL>/auth/callback` in Supabase Auth. Rebuild/redeploy after configuring
them: a build with no Supabase variables may prerender the demo profile.
Never put the service-role key in a `NEXT_PUBLIC_` variable or commit secrets.

1. Sign up with a nickname, email and password; follow the verification link if enabled.
2. Choose language, grade and persona answers. Take the optional placement quiz;
   refresh midway to check resume, return to onboarding and finish it.
3. Open Reels and watch five eligible clips for at least three seconds each.
   The quiz gate should lock scrolling. Complete the three-question reel quiz.
   Exiting early should leave the gate active when returning to Reels.
4. Open a suggested chapter, read through its pages and take the five-question
   check. At least three correct first tries should award the chapter bonus once.
5. Play a duel against the bot. Check results, XP and skill rating on the dashboard.
6. Open the Global leaderboard: fixture students should appear with rank,
   nickname and title only. Request/accept a friendship using a second real
   sign-up to test Friends ranking. The seeded friendships are between fixtures.
7. Edit language and grade at `/profile`, save, then revisit the dashboard.

Check the auth, onboarding, profile, header and nav at 360px width. Confirm the
bottom nav is visible in the duel lobby and hidden in an active duel. Temporarily
remove the service-role key in a local test to confirm the header reports unavailable
progress without blocking otherwise functioning feature pages. Restore it afterwards.

Live project setup, deployment, browser screenshots and a build are pending until
project access is configured and the relevant command runs are authorized. Do not
claim the walkthrough passed on the basis of unit tests alone.

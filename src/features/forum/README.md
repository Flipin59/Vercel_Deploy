# Forum — Sashwat Balaji

**You own:** `src/features/forum/`, `src/app/(app)/forum/`, `supabase/migrations/*_forum_*.sql`, tables prefixed `forum_`. (You also own the dashboard — see `src/features/dashboard/README.md`.)

## Goal
A safe place for students to ask money questions and help each other.

## Scope
- Threads and replies, upvotes, topics matching the four pillars.
- Post in any supported language.
- Safety, since users are minors: report button, basic moderation, no phone numbers / personal details in posts.
- Friends: send / accept requests, friend list. Tables `forum_friends*`; export `getFriends(userId)` from your `index.tsx` (server-only, not a server action) so Play and the dashboard can use it. Others see a username and title only, never a school or real name.

## Contracts
- User: `getCurrentProfile()` from `@/shared/session`.
- Progress: `recordActivity({ source: "forum", kind: "post_created" | "answer_accepted", pillar, xp })`.
- Strings: `useT({ en, te, hi })` with your `messages/*.json`.

## Stretch
- AI helper that answers with an explanation, never with an investment recommendation.
- **Translate (built):** Telugu and Hindi readers get a "Translate" button on a thread. `translateThreadAction` sends only the post text (never usernames or ids) to Google Cloud Translation through `@/shared/translate` (`GOOGLE_TRANSLATE_API_KEY`, server only) and caches results in `core_translations`. Without the key, or if the call fails, the button says translation isn't available.
- Mentor / NGO volunteer badge on replies.

# lifeIsGood

Financial literacy for Grades 11–12 students, learned by doing — reels, duels, manga lessons and a forum. Built for the Vanguard problem statement (`Vanguard-ps.pdf`) at Megathon 2026.

**Team:** Sanjith Ganapathi, Saikiran S, Nagamalla Sai Abhinav, Praveen V, Sashwat Balaji. Who owns what, the rules for not clashing, and which doc decides what: [`docs/TEAM.md`](docs/TEAM.md).

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Auth, database, realtime, file storage | Supabase (email + password auth with email verification, Postgres + row-level security, Realtime for duels, Storage for videos and manga pages) |
| AI content and translation | Claude API, called from server code only |
| Hosting | Vercel |

## Getting started

Needs Node 22+.

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev                  # http://localhost:3000
```

Every screen works without Supabase configured until a feature starts calling it: the signed-in user and progress tracking are stubbed in `src/shared/`.

## Layout

```
src/
  app/                  routes — thin files that render a feature
    (auth)/login/
    (app)/{dashboard,reels,play,learn,forum}/
  features/             one directory per feature, one owner each
    auth/ dashboard/ reels/ play/ learn/ forum/
      README.md         task brief
      index.tsx         entry point
      messages/         en / te / hi strings
  shared/               cross-feature contracts (single owner)
    session.ts          getCurrentProfile()
    progress/           recordActivity()
    i18n/               useT(), LanguageProvider
    supabase/           browser + server clients
    ui/ nav.ts types.ts
contents/               reel videos, lesson PDFs, audio — raw material, no code
supabase/migrations/    SQL, one file per change, tables prefixed per feature
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## No expensive commands

Do not run `npm install`, `npm ci`, `npm run build`, `npm run dev` or any other slow or network-heavy command unless the user asks for that specific run. Write the code and stubs, check what you can cheaply (e.g. a global `tsc` on pure files, `python3 -m json.tool` on JSON), and list what still needs installing, building or testing in your report.

## Keep it small and ask before deciding

- **Minimal code.** Write the least code that meets the spec. No speculative helpers, abstractions, options or config "for later"; no duplicated logic (reuse `@/shared/*` and the feature's own modules). Prefer editing an existing file to adding a new one.
- **Stay on the stack.** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (Postgres + RLS, Auth, Realtime, Storage), Node's built-in `node --test` for tests, Claude API from server code only. No new npm packages, UI kits, state libraries or test frameworks; if one seems necessary, stop and say why.
- **No silent design decisions.** The specs (`docs/TEAM.md` table, `IMPLEMENTATION.md`, `src/features/play/docs/*.md`, `UI.md`) are the source of truth. When a spec is ambiguous, contradicts itself or leaves a choice open (a number, a rule, a contract signature, a schema shape, a UI behaviour), ask the user before coding it. If you must pick to keep moving, say what you picked and why in your report — never bury it in code.
- **Changing a contract** another feature calls (exports from a feature's `index.tsx` / `server.ts`, anything in `src/shared/`) needs the user's OK first, and the affected owners named in your report.

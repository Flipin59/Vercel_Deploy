// Feed rules shared by the player and the server. Pure, no imports.

export const SKIP_MS = 3000; // a view under 3 s is a skip (RECOMMENDATION.md §1)
export const COMPLETE_RATIO = 0.8; // ≥ 80% watched is a completed view
export const QUIZ_EVERY = 5; // reels per reel quiz (QUESTIONS.md §6)
export const SESSION_LIMIT = 30; // stop card after 30 reels (RECOMMENDATION.md §7)

// The reels the quiz is about once the gate is reached, or null if not reached yet.
export function quizReels(viewed: string[]): string[] | null {
  return viewed.length >= QUIZ_EVERY ? viewed.slice(0, QUIZ_EVERY) : null;
}

// The rest of this tab's session after earlier visits (e.g. a quiz round-trip): `ranked`
// (already without the reels shown this session) up to the 30-reel limit, with `keep` (a
// shared link's reel) first even if seen. `stop` = the limit cut the feed short, so the
// stop card shows instead of "all caught up".
export function sessionFeed<T extends { id: string }>(ranked: T[], seen: string[], keep?: T) {
  const items = keep ? [keep, ...ranked.filter((r) => r.id !== keep.id)] : ranked;
  const left = Math.max(0, SESSION_LIMIT - seen.length);
  return { items: items.slice(0, left), stop: left === 0 || items.length > left };
}

// Same seed, same numbers (mulberry32): the server and the browser rank the feed alike.
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

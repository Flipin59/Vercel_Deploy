// Public API of the reels feature. Safe to import from server and client code.
// The page itself lives in ReelsPage.tsx and is mounted only by /reels.
export { REELS, getReel } from "./manifest";
export type { Reel } from "./manifest";

// Link to the feed starting at one reel (dashboard "Continue", shares).
export function reelHref(reelId?: string): string {
  return reelId ? `/reels?r=${encodeURIComponent(reelId)}` : "/reels";
}

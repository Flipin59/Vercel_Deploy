// Levels, titles and skill rating (RATING.md). Pure: no runtime imports, so
// `node --test` can load it directly.
import type { Tier } from "./types";

export const XP_PER_LEVEL = 100;

export function getLevel(totalXp: number): { level: number; progress: number } {
  const xp = Math.max(0, Math.floor(totalXp));
  return { level: Math.floor(xp / XP_PER_LEVEL) + 1, progress: xp % XP_PER_LEVEL };
}

// Levels per division, easiest tier first (RATING.md §3). Diamond 1 is open-ended.
const LEVELS_PER_DIVISION: [Tier, number][] = [
  ["bronze", 5],
  ["silver", 6],
  ["gold", 7],
  ["platinum", 8],
  ["diamond", 10],
];

export type Title = { tier: Tier; division: 1 | 2 | 3; label: string };

export function getTitle(level: number): Title {
  let start = 1;
  for (const [tier, span] of LEVELS_PER_DIVISION) {
    for (const division of [3, 2, 1] as const) {
      if (level < start + span || (tier === "diamond" && division === 1)) {
        return { tier, division, label: `${tier[0].toUpperCase()}${tier.slice(1)} ${division}` };
      }
      start += span;
    }
  }
  throw new Error("unreachable");
}

// Title tier: follows the level and never goes down.
export function getTier(level: number): Tier {
  return getTitle(level).tier;
}

// Skill rating (RATING.md §10, SCORE.md §8).
export const START_RATING = 800;
export const RATING_FLOOR = 100;
export const TIER_RATING = {
  bronze: 800,
  silver: 1000,
  gold: 1200,
  platinum: 1400,
  diamond: 1600,
} as const satisfies Record<Tier, number>;

export function getSkillTier(rating: number): Tier {
  if (rating >= 1500) return "diamond";
  if (rating >= 1300) return "platinum";
  if (rating >= 1100) return "gold";
  if (rating >= 900) return "silver";
  return "bronze";
}

// How many tiers `a` is above `b` (negative when below).
export function tierDiff(a: Tier, b: Tier): number {
  return (TIER_RATING[a] - TIER_RATING[b]) / 200;
}

// Elo expected score of `rating` against `opponent` (a question's tier rating or a player).
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

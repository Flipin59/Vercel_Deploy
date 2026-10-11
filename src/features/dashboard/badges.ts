// Badges and weekly goals (Wave 3b). Worked out from the student's own xp_events, so
// there is no table to keep in step, and they never give coins (QUIZ.md). Pure.
import { PILLARS, type Pillar } from "../../shared/types.ts";

export type BadgeInput = {
  kinds: Record<string, number>; // xp_events per kind, all time
  streakDays: number;
  pillarXp: Record<Pillar, number>;
};

export const PILLAR_BADGE_XP = 100;
export const WEEKLY_XP_GOAL = 100;
export const WEEKLY_VARIETY_GOAL = 3; // different features used in the last 7 days

const count = (i: BadgeInput, kind: string) => i.kinds[kind] ?? 0;
const BADGES: { id: string; icon: string; earned: (i: BadgeInput) => boolean }[] = [
  { id: "first-reel", icon: "🎬", earned: (i) => count(i, "reel_watched") >= 1 },
  { id: "reels-10", icon: "🍿", earned: (i) => count(i, "reel_watched") >= 10 },
  { id: "first-chapter", icon: "📖", earned: (i) => count(i, "chapter_finished") >= 1 },
  { id: "chapters-3", icon: "📚", earned: (i) => count(i, "chapter_finished") >= 3 },
  { id: "first-duel-win", icon: "⚔️", earned: (i) => count(i, "duel_won") >= 1 },
  { id: "streak-7", icon: "🔥", earned: (i) => i.streakDays >= 7 },
  { id: "helper", icon: "🤝", earned: (i) => count(i, "answer_accepted") >= 1 },
  ...PILLARS.map((p) => ({
    id: `pillar-${p}`,
    icon: { budget: "📊", save: "💰", invest: "📈", safety: "🛡️" }[p],
    earned: (i: BadgeInput) => i.pillarXp[p] >= PILLAR_BADGE_XP,
  })),
];
export const BADGE_KINDS = ["reel_watched", "chapter_finished", "duel_won", "answer_accepted"];

export type Badge = { id: string; icon: string; earned: boolean };
export function getBadges(input: BadgeInput): Badge[] {
  return BADGES.map((b) => ({ id: b.id, icon: b.icon, earned: b.earned(input) }));
}

export type WeeklyGoal = { id: "xp" | "variety"; value: number; target: number };
// The last 7 days, like the leaderboard: XP earned and how many features were used.
export function getWeeklyGoals(weeklyXp: number, sources: string[]): WeeklyGoal[] {
  return [
    { id: "xp", value: Math.min(weeklyXp, WEEKLY_XP_GOAL), target: WEEKLY_XP_GOAL },
    { id: "variety", value: Math.min(new Set(sources).size, WEEKLY_VARIETY_GOAL), target: WEEKLY_VARIETY_GOAL },
  ];
}

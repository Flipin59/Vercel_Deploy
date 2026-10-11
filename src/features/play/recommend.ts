// Recommendation engine (RECOMMENDATION.md §2–4). Pure: no database access.
// The caller drops reels completed in the last 30 days and reels already shown this
// session; buildFeed applies the language and level-window filters itself.
import type { ContentItem, RecUser } from "@/shared/types";

type Opts = { now?: number; random?: () => number };

const DAY_MS = 86_400_000;
const engaged = ({ likes, saves, completions }: ContentItem["stats"]) => likes + 2 * saves + completions;

// 0–1, higher = recommend first (§3). `candidates` is the list the item is ranked in:
// popularity is smoothed by their pooled rate and divided by the best of them.
export function scoreItem(item: ContentItem, user: RecUser, candidates: ContentItem[], { now = Date.now() }: Opts = {}): number {
  const isNew = item.kind === "reel" ? user.reelsWatched < 20 : user.chaptersOpened < 3;
  const maxPillarXp = Math.max(...Object.values(user.pillarXp));
  // New users: the onboarding persona's need for the pillar when there is one (§3).
  const personaNeed = isNew ? user.persona?.pillarNeed?.[item.pillar] : undefined;
  const pillarNeed = personaNeed ?? (maxPillarXp > 0 ? 1 - user.pillarXp[item.pillar] / maxPillarXp : 0.5);
  const maxTag = Math.max(0, ...(Object.values(user.tagInterest) as number[]));
  const bestTag = Math.max(0, ...item.tags.map((t) => user.tagInterest[t] ?? 0));
  const topicFit = item.tags.some((t) => user.recentWrongTags.includes(t))
    ? 1
    : 0.5 * pillarNeed + 0.5 * (maxTag > 0 ? bestTag / maxTag : 0);

  const pool = candidates.filter((c) => c.kind === item.kind);
  const views = pool.reduce((n, c) => n + c.stats.views, 0);
  const avgRate = views > 0 ? pool.reduce((n, c) => n + engaged(c.stats), 0) / views : 0;
  const rate = (c: ContentItem) => (engaged(c.stats) + 20 * avgRate) / (c.stats.views + 20);
  const maxRate = Math.max(0, ...pool.map(rate));
  const popularity = maxRate > 0 ? rate(item) / maxRate : 0;

  const friends = Math.min(item.friendsEngaged, 3) / 3;
  const levelFit = Math.max(0, 1 - Math.abs(item.level - user.level) / 10);
  const ageDays = (now - Date.parse(item.createdAt)) / DAY_MS;
  const freshness = ageDays <= 7 ? 1 : Math.max(0, (30 - ageDays) / 23);

  return (isNew ? 0.15 : 0.3) * topicFit + (isNew ? 0.4 : 0.25) * popularity
    + 0.2 * friends + 0.15 * levelFit + 0.1 * freshness;
}

// Orders reels into the feed (§2 language + level window, §4 variety, exploration and
// stretch). Returns the whole ordering; the caller pages it and stops at 30 (§7).
export function buildFeed(candidates: ContentItem[], user: RecUser, opts: Opts = {}): ContentItem[] {
  const random = opts.random ?? Math.random;
  const own = candidates.filter((c) => c.language === user.language);
  let lo = user.level - 8;
  let hi = user.level + 4;
  const inWindow = (c: ContentItem) => c.level >= lo && c.level <= hi;
  for (let i = 0; i < 3 && own.filter(inWindow).length < 20; i++) {
    lo -= 5;
    hi += 5;
  }
  // At most one per page may sit above the window, up to 8 levels above the user.
  const isStretch = (c: ContentItem) => c.level > hi && c.level <= user.level + 8;
  const pool = own.filter((c) => inWindow(c) || isStretch(c));
  const score = new Map(pool.map((c) => [c, scoreItem(c, user, pool, opts)]));
  const left = pool.sort((a, b) => score.get(b)! - score.get(a)!);

  const feed: ContentItem[] = [];
  while (left.length) {
    const page = feed.slice(feed.length - (feed.length % 10));
    // Once only stretch items are left, the cap gives way (like variety) instead of dropping them.
    const inside = left.filter((c) => !isStretch(c));
    const allowed = page.some(isStretch) && inside.length ? inside : left;
    const [prev, prev2] = [feed.at(-1), feed.at(-2)];
    const varied = allowed.filter(
      (c) =>
        !(prev && prev2 && prev.pillar === c.pillar && prev2.pillar === c.pillar) &&
        !prev?.tags.some((t) => c.tags.includes(t)),
    );
    const choices = varied.length ? varied : allowed;
    // Every 5th slot is a random pick instead of the top-scored one.
    const pick = feed.length % 5 === 4 ? choices[Math.floor(random() * choices.length)] : choices[0];
    feed.push(pick);
    left.splice(left.indexOf(pick), 1);
  }
  return feed;
}

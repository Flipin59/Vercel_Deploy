// Cross-feature types. Owned by platform — propose changes in the team chat first.

export const LANGUAGES = ["en", "te", "hi"] as const;
export type Language = (typeof LANGUAGES)[number];

// The four learning pillars from the problem statement. Tag all content with one.
export const PILLARS = ["budget", "save", "invest", "safety"] as const;
export type Pillar = (typeof PILLARS)[number];

// Easiest first. Titles, question difficulty and skill tiers all use these (RATING.md).
export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type Tier = (typeof TIERS)[number];

// Fixed tag list from QUESTIONS.md §3. Add new tags there first.
export const TAGS = {
  budget: ["needs-vs-wants", "tracking-spending", "50-30-20", "pocket-money", "bills-and-emi"],
  save: ["emergency-fund", "savings-goals", "bank-accounts", "simple-interest", "compound-interest", "inflation"],
  invest: ["risk-and-return", "diversification", "time-horizon", "mutual-fund-basics", "stocks-basics", "gold-and-fd"],
  safety: ["upi-fraud", "otp-and-pin", "phishing", "fake-loan-apps", "ponzi-and-chit-scams", "insurance-basics"],
} as const satisfies Record<Pillar, readonly string[]>;
export type Tag = (typeof TAGS)[Pillar][number];

export type FeatureName = "auth" | "reels" | "play" | "learn" | "forum";

export type QuestionContext = "practice" | "duel" | "reel" | "chapter" | "placement";

export type Profile = {
  id: string;
  username: string;
  language: Language;
  grade: 11 | 12 | null;
  onboardedAt?: string | null;
  persona?: { answers?: Record<string, string>; pillarNeed?: Record<Pillar, number> };
  role?: Role; // set by an admin only; absent = student
};

// 'teacher' sees their cohorts' progress (/cohort); 'mentor' is an NGO volunteer. Both get
// a badge on forum replies.
export type Role = "student" | "teacher" | "mentor";

// What other students may see of someone (RATING.md §7). `level` only for friends.
export type PublicProfile = {
  id: string;
  username: string;
  title: string;
  level?: number;
  role?: "teacher" | "mentor"; // absent for students
};

// A reel or chapter as the recommendation engine sees it (RECOMMENDATION.md §1).
export type ContentItem = {
  id: string; // reel id or chapter slug
  kind: "reel" | "chapter";
  pillar: Pillar;
  tags: Tag[];
  level: number;
  language: Language;
  captionLanguages?: Language[]; // languages available in captions for this content
  createdAt: string;
  requires?: string[]; // chapters only
  // Engagement over the last 30 days; for chapters views = opened, completions = finished.
  stats: { views: number; likes: number; saves: number; completions: number };
  friendsEngaged: number; // friends who engaged in the last 14 days
};

// The user as the recommendation engine sees it (RECOMMENDATION.md §8).
export type RecUser = {
  id: string;
  level: number;
  language: Language;
  pillarXp: Record<Pillar, number>;
  tagInterest: Partial<Record<Tag, number>>; // last 14 days
  recentWrongTags: Tag[]; // wrong answers in the last 7 days
  reelsWatched: number;
  chaptersOpened: number;
  persona?: Profile["persona"]; // initial pillar need before XP history exists
};

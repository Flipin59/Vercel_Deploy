# Rating: levels, titles and skill rating

The scales every student and every piece of content are placed on. How XP and rating changes are earned is in SCORE.md; this file defines what they add up to.

Owner: Sanjith Ganapathi (Play).

## 1. Principles

- **Two numbers, both shown to the student, nothing hidden.**
  - **Level** (from XP, sections 2–3) is progress. It never goes down and gives the title, Bronze 3 to Diamond 1.
  - **Skill rating** (section 10) is how well the student answers right now. It goes up and down after quizzes and duels, and decides question difficulty, the XP multiplier and duel matchmaking.
- **Shared scales for students and content.**
  - Reels and chapters have a level, so "content near my level" means the same thing in Reels and Learn.
  - Questions have a tier, and each tier has a rating (section 10), so "questions near my skill" means the same thing in every quiz and duel.
- **Progress never goes down.** Levels and the progress inside a level only increase. A bad quiz or a lost duel can lower the skill rating, never the level or the title.

## 2. Levels and progress

- **1 level = 100 XP.**
- **Progress** is the XP earned inside the current level, shown as 0–100%.
- **At 100%** the student moves to the next level, and any XP above 100% carries over.
- **Where the XP comes from:** the existing `xp_events` table, written only through `recordActivity()`. No separate rating table is stored.

```
totalXp  = sum of the user's xp_events.xp
level    = floor(totalXp / 100) + 1
progress = totalXp % 100
```

## 3. Titles

Levels are grouped into titles.
- **Tiers:** five, from Bronze to Diamond.
- **Divisions:** each tier has three, counting down from 3 to 1.
- **Getting harder:** higher tiers need more levels per division.

| Title | Levels per division | Levels | Total XP at start |
| --- | --- | --- | --- |
| Bronze 3 | 5 | 1–5 | 0 |
| Bronze 2 | 5 | 6–10 | 500 |
| Bronze 1 | 5 | 11–15 | 1,000 |
| Silver 3 | 6 | 16–21 | 1,500 |
| Silver 2 | 6 | 22–27 | 2,100 |
| Silver 1 | 6 | 28–33 | 2,700 |
| Gold 3 | 7 | 34–40 | 3,300 |
| Gold 2 | 7 | 41–47 | 4,000 |
| Gold 1 | 7 | 48–54 | 4,700 |
| Platinum 3 | 8 | 55–62 | 5,400 |
| Platinum 2 | 8 | 63–70 | 6,200 |
| Platinum 1 | 8 | 71–78 | 7,000 |
| Diamond 3 | 10 | 79–88 | 7,800 |
| Diamond 2 | 10 | 89–98 | 8,800 |
| Diamond 1 | open | 99+ | 9,800 |

**Title tier** means the title without its division (Bronze, Silver, Gold, Platinum, Diamond). The **skill tier** is the band the skill rating falls in (section 10), using the same five names. Questions are graded by tier (QUESTIONS.md), and SCORE.md compares a question's tier with the student's *skill* tier for its difficulty multiplier.

**Pace.** A practice quiz at the student's own tier earns up to 100 XP, if all 10 answers are correct. That's one level. Leaving Bronze takes about 15 good quizzes; reaching Diamond takes around 100, plus duels.

## 4. Starting level

- Everyone starts at **level 1, Bronze 3**, with a skill rating of **800** (Bronze).
- **Optional placement quiz** during onboarding:
  - 8 questions that get harder: 3 Bronze, 3 Silver, 2 Gold.
  - Each correct answer gives 40 XP (`kind: "placement"`, `source: "play"`).
  - The most it can give is 320 XP, ending at level 4 (Bronze 3, 20%).
  - Each answer also moves the skill rating with K = 32 (SCORE.md §8), so a strong student starts in a higher skill tier.
  - It can be taken once, and only during onboarding. It can be resumed after an interruption; a question that was on screen when the student left counts as a timeout (wrong).

## 5. Per-pillar strength

There is one level per student, not one per pillar. Strength in each pillar is that pillar's XP: the sum of `xp_events.xp` where `pillar = <pillar>`.

- RECOMMENDATION.md and QUESTIONS.md use it to find the weakest pillar.
- The dashboard can show it as four bars, each relative to the student's strongest pillar.
- It is never shown as a separate level or title, so students see only one rank.

## 6. Content levels

Authors set the level of each reel and chapter (1–99) and the tier of each question. A question's tier also fixes its rating (section 10). Use this guide:

| Tier | Levels | What the content asks of the student | Examples |
| --- | --- | --- | --- |
| Bronze | 1–15 | Know the idea | Needs vs wants; what UPI is; never share an OTP |
| Silver | 16–33 | Apply it to an everyday choice | Plan a month of pocket money; spot a phishing SMS; why keep an emergency fund |
| Gold | 34–54 | Calculate | Simple vs compound interest; inflation eating savings; EMI on a phone |
| Platinum | 55–78 | Weigh trade-offs | Risk and return; why diversify; FD vs a market-linked option; reading loan terms |
| Diamond | 79+ | Plan across several steps | A savings plan for college fees; recovering from a scam; comparing insurance basics |

Questions are recalibrated automatically (QUESTIONS.md section 7). Reels and chapters keep the level their author gave them.

## 7. Who sees what

| Viewer | Sees |
| --- | --- |
| The student | Title, level, progress %, skill rating, per-pillar bars, XP history, coins |
| Friends | Title and level |
| Everyone else (forum, duel opponents, global leaderboard) | Title only, e.g. a "Silver 2" badge |

- **Leaderboards:** two tabs, Friends and Global.
  - Both rank by XP earned in the last 7 days rather than by total, so a new student can still top them.
  - Each row shows rank, username and title. No XP, rating, coins, school or city.
  - The student also sees their own rank, even when they're outside the top rows.
- **No public numbers:** XP totals, progress %, the skill rating and coins are shown only to the student. The server computes titles, levels and ranks for others; students can't read each other's ledger rows.

## 8. Level-ups in the UI

- **Level up:** a small celebration on the screen where it happened, e.g. the duel result or the end of a quiz.
- **Title up:** a full-screen celebration with the new badge, shown once.
- **No push notifications** for levelling up.

## 9. Code

These pure functions live in `src/shared/rating.ts` (IMPLEMENTATION.md S2):

- `getLevel(totalXp)` → `{ level, progress }`
- `getTitle(level)` → `{ tier, division, label }`, e.g. `{ tier: "silver", division: 2, label: "Silver 2" }`
- `getTier(level)` → `"bronze" | "silver" | "gold" | "platinum" | "diamond"` (title tier)
- `getSkillTier(rating)` → the same five tiers (section 10)
- `TIER_RATING`, `START_RATING` (800) and `expectedScore(rating, opponentRating)` for SCORE.md §8

The dashboard, profile, forum badge, quiz and duels all call these, so no feature computes levels or ratings its own way.

## 10. Skill rating

| Skill tier | Student rating | Question rating |
| --- | --- | --- |
| Bronze | below 900 | 800 |
| Silver | 900–1099 | 1000 |
| Gold | 1100–1299 | 1200 |
| Platinum | 1300–1499 | 1400 |
| Diamond | 1500 and up | 1600 |

- Starts at 800, never goes below 100, has no ceiling.
- Changes after every first-try quiz answer and every duel. The formula is in SCORE.md §8.
- Stored as `rating_delta` on the activity ledger, so rating = 800 + the sum. No separate table (IMPLEMENTATION.md §6).
- **Used for:** question difficulty (QUESTIONS.md §4–5), the XP difficulty multiplier (SCORE.md §3), duel XP upsets (SCORE.md §4), duel matchmaking and the bot (RECOMMENDATION.md §6).
- **Not used for:** titles, or the level windows for reels and chapters. Those follow the level.
- **Shown:** to the student only, on the dashboard, the quiz end screen and their own side of the duel screen.

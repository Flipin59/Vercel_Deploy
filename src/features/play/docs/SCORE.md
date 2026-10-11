# Scoring

How quiz answers, duels and simulations turn into XP (level progress) and skill rating changes, across every feature that has a quiz. This scoring system doesn't award coins: coins are in scope for the project, and their amounts are defined only in QUIZ.md §6.

Owner: Sanjith Ganapathi (Play). Changes to the numbers here need a heads-up in the team chat, because Reels, Learn, Forum and the dashboard all follow them.

## 1. Levels and titles

Levels, progress and titles are defined in RATING.md. The short version:
- 1 level = 100 XP, and progress % is the XP earned inside the current level.
- Levels and progress never go down. The skill rating (RATING.md §10) can.
- Titles run from Bronze 3 to Diamond 1.
- A question's tier (Bronze to Diamond) is compared with the student's skill tier, which comes from their rating.

## 2. What this file covers

How many XP each quiz answer, duel and simulation is worth (sections 3–5), and how the skill rating changes (section 8). Every amount here is worked out on the server and reported through `recordActivity()`; RATING.md turns the XP total into a level.

## 3. XP per correct answer

Every quiz question has a difficulty tier (Bronze to Diamond). A correct answer earns:

```
xp = round(base[context] × difficultyMultiplier), minimum 1
```

Wrong answers and unanswered questions earn 0.

**Base XP by context**

| Where | Context | Base XP per correct answer | Notes |
| --- | --- | --- | --- |
| Play | Practice quiz | 10 | |
| Learn | End-of-chapter check | 5 | +10 bonus if the chapter check is ≥ 60% correct (3 of 5), on the student's first check of that chapter (one where nothing was answered before), after reading it to the last page |
| Reels | Quiz after every 5 reels (3 questions) | 5 | |
| Onboarding | Placement quiz | 40 | Flat, no multiplier (RATING.md §4) |
| Play | Duel | see section 4 | |
| Play | Solo simulation | see section 5 | |

**Difficulty multiplier**: question tier compared with the user's current skill tier (RATING.md §10).

| Question tier vs user tier | Multiplier |
| --- | --- |
| 2 or more tiers above | ×2 |
| 1 tier above | ×1.5 |
| Same tier | ×1 |
| 1 tier below | ×0.5 |
| 2 or more tiers below | ×0.25 |

Easy questions are worth very little to strong students, so grinding Bronze questions doesn't get anyone to Diamond.

**Repeats**
- Only the first try at a question counts for XP and rating. QUIZ.md allows one reattempt for a coin; it earns no XP and doesn't change the rating.
- A question answered correctly in the last 30 days earns 0 XP.
- A question that comes back for review (answered wrong earlier) earns half XP.

**Daily soft cap.** After 300 quiz XP in one day (IST), further quiz XP that day is halved. Duel XP is included in the cap: it counts toward the 300, and duel XP earned past it is halved too (minimum 1).

## 4. Duels

### Who wins

- 5 rounds, the same question for both players, 30 seconds per round.
- **Fastest finger.** The first correct answer to reach the server takes the round and scores 100 + speed bonus, where speed bonus = `round(50 × timeLeft / 30s)`. The other player scores 0 for that round.
- A wrong answer freezes that player for the rest of the round. The round ends when someone answers correctly, both players are frozen, or time runs out (nobody scores).
- Higher total after 5 rounds wins. Equal totals are a draw.
- **The server decides who was first**, by the order answers arrive in the database — not the phones' clocks and not the Realtime channel (IMPLEMENTATION.md §6). The question is sent to both phones before the round and revealed by one server "go" message. A slower connection can still cost a close round; this is accepted.
- A player who leaves mid-duel loses. If they leave before round 1 is answered (by either player or the bot) while round 1 is still running, or never opened the duel after it started (an abandoned invite, a quick-match player who closed the app), the duel is cancelled and nobody earns XP. A duel whose five rounds already played out is finished normally, not forfeited.
- A player who left is credited with the result (usually the loss) the next time they open Play or start a duel.

### XP from a duel

The winner always gains XP. The loser never loses any.

```
gap      = round((loserRating − winnerRating) / 25)   // positive when the winner beat a higher rating
winXp    = clamp(30 + 3 × gap, 10, 60)
```

| Result | Winner | Loser |
| --- | --- | --- |
| Win / loss | `winXp` + 2 per round won | 2 per round won |
| Draw | 15 + 2 per round won | same |

Examples:
- Rating 1000 beats 1000 → 30 XP.
- Rating 1000 beats 1125 → 45 XP.
- Rating 1125 beats 1000 → 15 XP.
- Rating 1500 beats 900 → 10 XP (the minimum).

If the win pushes progress past 100%, the winner levels up immediately, and the result screen shows it.

**Limits**
- **Bot duels** give half of every number above. The bot plays at the user's own rating.
- **Bot duels per day:** only a student's first 5 finished bot duels per day (IST) earn XP and rating. Further bot duels still play, but change nothing.
- **The same two players** can earn XP and rating from at most 3 duels against each other per day. Further duels still play, but change nothing.
- Duel XP does not use the difficulty multiplier, since duel questions are picked to match both players.

## 5. Solo simulations

Each simulation defines its own outcome score from 0 to 100 in its spec (e.g. "survived the month with savings left" = 100), and states the assumptions behind it.

```
xp = round(outcomeScore × 0.3)    // 0–30 XP
```

Only the first run of each simulation per day earns XP, so students can replay freely to try other choices.

## 6. Reporting XP

Every feature reports XP through the existing shared call, one event per scored action:

```ts
recordActivity({ source: "play", kind: "duel_won", pillar: "budget", xp: 45, ratingDelta: 12, ref: "duel:<duelId>" });
```

| kind | source | XP |
| --- | --- | --- |
| `quiz_answer_correct` | play | section 3 |
| `duel_won` / `duel_draw` / `duel_lost` | play | section 4 |
| `sim_completed` | play | section 5 |
| `chapter_check_answer` | learn | section 3 |
| `chapter_finished` | learn | 10 if ≥ 60% correct |
| `reel_quiz_answer` | reels | section 3 |
| `placement` | play | 40 (RATING.md §4) |
| `reel_watched` | reels | 1 (proposed, Reels owner to confirm) |
| `post_created` / `answer_accepted` | forum | 2 per thread, at most 5 a day (replies earn none) / 10 to the helper, once per thread on the first accept |

- **Rating changes** ride on the same event as `ratingDelta` (section 8). Coins ride on it as `coins`; coin-only events are listed in QUIZ.md §6.
- **Server code only.** `recordActivity()` can't be called from the browser, and no event's amount comes from the client (IMPLEMENTATION.md §6).
- **Always set `pillar`.** Summing XP by pillar gives each user's progress per pillar. RECOMMENDATION.md and QUESTIONS.md use it to find weak pillars, so no separate per-pillar rating is stored.
- **Non-quiz XP stays small** (reels watched, forum posts), so levels mostly reflect questions answered.

## 7. Open items

- **Answer history.** The repeat rules in section 3 need a per-user record of answered questions. Play stores it in a `play_answers` table. Reels and Learn either keep their own or call a Play export.
- **Where this file lives.** It belongs in `docs/` next to TEAM.md once Praveen agrees.

## 8. Rating changes

The skill rating (RATING.md §10) moves after quiz answers and duels, using the Elo formula. Each question tier has a fixed rating: Bronze 800, Silver 1000, Gold 1200, Platinum 1400, Diamond 1600.

```
expected = 1 / (1 + 10 ^ ((opponentRating − rating) / 400))
```

**Quiz answers** (practice, reel, chapter and placement), first try only. The opponent is the question's tier rating.

```
correct          → round(K × (1 − expected) × (1 + 0.5 × timeLeft / 30s))
wrong / timed out → round(−K × expected)
```

- K = 4 for practice, reel and chapter quizzes; K = 32 for the placement quiz, so a new student is placed quickly.
- A correct answer never lowers the rating, and a fast one raises it more.
- The end screen shows the sum for the quiz (QUIZ.md §4).
- Example: rating 1000, ten Silver questions (expected 0.5), 7 right with half the time left and 3 wrong: 7 × round(2.5) − 3 × 2 = 21 − 6 = **+15**.

**Duels.** The opponent is the other player, or the bot rated the same as the student.

```
change = round(K × (result − expected))      // result: 1 win, 0.5 draw, 0 loss
```

- K = 24 against a student, 12 against the bot.
- Duels past the daily pair cap or the daily bot-duel cap (section 4) don't change the rating.

**Floor.** The rating never goes below 100.

**Drift.** The speed factor makes ratings creep upwards slowly. Recheck the tier bands (RATING.md §10) after the pilot.

# Quiz

The one quiz screen (`QuizRunner`) that every feature uses, and the **single source of truth for coins** (section 6). Which questions appear is in QUESTIONS.md, XP is in SCORE.md, and the skill rating is in RATING.md §10 and SCORE.md §8.

Owner: Sanjith Ganapathi (Play) builds it. Changes to coin amounts go through the team chat.

## 1. Who calls it

The quiz accepts topics as input and selects questions by the rules in QUESTIONS.md, using only the topics passed in by the caller. Callers open it at `/play/quiz` with `quizHref({ context, returnTo, pillar?, reelIds?, chapterSlug? })` from `@/features/play`; they never import `QuizRunner`. The number of questions comes from the context, not the URL.

| Caller | Context | Questions (y) | Topics passed in |
| --- | --- | --- | --- |
| Play practice quiz (`/play/quiz`) | `practice` | 10 | optional pillar |
| Reels, after every 5 reels | `reel` | 3 | the ids of those 5 reels |
| Learn, "End module" button | `chapter` | 5 | the chapter slug |
| Onboarding placement quiz | `placement` | 8 | — (RATING.md §4) |

Duels have their own screen (UI.md page 6, SCORE.md §4) and don't use this one.

## 2. Screen

- A 30 s timer at the top.
- An exit (✕) button at the top left. Answers already given keep their XP, coins and rating change; the rest of the quiz is dropped. A reel quiz comes back when the student returns to the feed (RECOMMENDATION.md §4).
- "x / y" at the top right: x is the current question, y the total, which the caller sets (section 1).
- The question below the timer.
- The options below the question: A and B on the first row, C and D below them.

## 3. Answering

- **Correct on the first try:** correct screen with "+3 coins", then the next question.
- **Wrong, or the timer runs out:** wrong screen with two choices:
  - **Reattempt for 1 coin.** Only one reattempt per question. Disabled with "Not enough coins" when the balance is 0. Not offered in the placement quiz.
  - **Show answer:** shows the correct answer, then a Next button.
- **Reattempt correct:** the wagered coin is returned. No extra coins, no XP and no rating change, because only the first try counts (SCORE.md §3).
- **Reattempt wrong:** wrong screen with the correct answer shown and a Next button. The coin is lost.
- The explanation is shown with the correct answer every time.

## 4. End screen

- "You answered a / y", where a counts correct first tries.
- Coins earned (net of wagers) and XP earned.
- The updated skill rating with the net change: "+5" in green if 5 rating points were gained, "−6" in red if 6 were lost (SCORE.md §8).
- A level-up or title-up celebration if one happened (RATING.md §8).
- Buttons: **Review answers** (a second view of the same screen, with a "Back to summary" button; layout in UI.md page 9) and **End quiz** (back to whoever called the quiz).

## 5. What the quiz sends

For each question the screen sends the chosen answer, the time taken and whether it is the first try or the reattempt, through `submitAnswer()` (QUESTIONS.md §9). The server already knows each question's difficulty and works out XP (SCORE.md §3), coins (section 6) and the rating change (SCORE.md §8). Nothing the phone calculates is trusted (IMPLEMENTATION.md §6).

## 6. Coins

Coins are a practice currency for reattempts, never real money. This section is the only place coin amounts are defined; every other doc links here.

| Event | Coins | Recorded as |
| --- | --- | --- |
| Correct first try in a practice, reel or chapter quiz | +3 | on the same event as that answer's XP (SCORE.md §6) |
| Reattempt wager | −1 | `quiz_reattempt_wager`, source `play` |
| Reattempt correct, wager returned | +1 | `quiz_reattempt_refund`, source `play` |
| Daily login, first visit each IST day | +10 | `daily_login`, source `auth` |

- No coins in duels or the placement quiz.
- The balance never goes below 0.
- A question answered correctly in the last 30 days earns no coins, as it earns no XP (SCORE.md §3). The rating still moves.
- Coins buy reattempts and nothing else.
- Coins sit in the same ledger as XP (`xp_events.coins`), written only by server code through `recordActivity()`. Balance = the sum.
- Only the student sees their coins (header pill and end screen). Coins never appear on leaderboards or profiles.

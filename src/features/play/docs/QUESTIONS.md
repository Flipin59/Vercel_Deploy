# Questions

The question bank and how questions are picked for each quiz. The quiz screen and coins are in QUIZ.md, XP and rating changes in SCORE.md; this file decides *which* questions a student sees.

Owner: Sanjith Ganapathi (Play). Reels and Learn use the same bank for their checks, so changes go through the team chat.

## 1. Where questions appear

| Where | Questions | Picked by |
| --- | --- | --- |
| Play practice quiz | 10 per quiz | Algorithm in section 4 |
| Play duel | 5 per duel, same for both players | Section 5 |
| Play solo simulation | Decision points written into the simulation | The simulation itself — not from the bank |
| Reels quiz, after every 5 reels | 3 per quiz | Section 6 |
| Learn end-of-chapter check | 5 per chapter, drawn from a pool of up to 8 linked to the chapter | Section 6 |
| Onboarding placement quiz | 8: 3 Bronze, 3 Silver, 2 Gold | RATING.md §4 |

There is one bank for all of them. A reel's or chapter's question can later come back in a practice quiz for review, and every question's difficulty is calibrated from all of its answers.

## 2. A question

Stored in `play_questions`.

| Field | Meaning |
| --- | --- |
| `id` | Stable id, e.g. `save-compound-007` |
| `pillar` | `budget`, `save`, `invest` or `safety` |
| `tags` | 1–3 subtopics from the list in section 3 |
| `tier` | Difficulty: `bronze`, `silver`, `gold`, `platinum`, `diamond` (the same tiers as RATING.md). Each tier has a fixed rating for SCORE.md §8 (RATING.md §10) |
| `type` | `mcq` (4 options) or `true_false`. A `number` type (numeric answer with a tolerance) can be added in a later migration when the bank needs it |
| `content` | Per language: prompt, options, correct answer, explanation. `{ en: {...}, te: {...}, hi: {...} }` |
| `reel_id` / `chapter_slug` | Set when the question belongs to a reel or chapter. Each reel has exactly one linked question |
| `status` | `draft`, `live`, `retired`. Only `live` questions are served |
| `source` | `human` or `ai` |
| `answers_count`, `correct_count` | Running totals, used for calibration (section 7) |

Answers are logged in `play_answers`: user, attempt, question, context (`practice`, `duel`, `reel`, `chapter`, `placement`), try (1, or 2 for the coin reattempt in QUIZ.md), correct, time taken, XP, coins and rating change given, time answered. Both the selection rules below and the repeat rules in SCORE.md read from it. Each quiz run is a row in `play_attempts` with the question ids it served, in order; that is what "shown" means in section 4. Schema: `supabase/migrations/20261011120001_play_quiz.sql`.

## 3. Tags

Tags come from a fixed list so selection can balance topics. Add new tags here first.

| Pillar | Tags |
| --- | --- |
| budget | `needs-vs-wants`, `tracking-spending`, `50-30-20`, `pocket-money`, `bills-and-emi` |
| save | `emergency-fund`, `savings-goals`, `bank-accounts`, `simple-interest`, `compound-interest`, `inflation` |
| invest | `risk-and-return`, `diversification`, `time-horizon`, `mutual-fund-basics`, `stocks-basics`, `gold-and-fd` |
| safety | `upi-fraud`, `otp-and-pin`, `phishing`, `fake-loan-apps`, `ponzi-and-chit-scams`, `insurance-basics` |

## 4. Practice quiz

### Inputs

- **User tier:** the user's skill tier, from their rating (RATING.md section 10).
- **Pillar strength:** the user's XP per pillar, summed from `xp_events`. The pillar with the least XP counts as the weakest.
- **Answer history:** from `play_answers`.
- **Language:** from the profile.
- **Recent content:** reels watched and chapters read in the last 7 days.

### Step 1: filter

Keep only questions that are:
- `live`
- available in the user's language
- not answered correctly by this user in the last 30 days
- not shown to this user in the last 24 hours

### Step 2: fill slots

A 10-question quiz has these slots:

| Slots | Rule |
| --- | --- |
| Difficulty | Lower half of the skill tier's rating band: 3 one tier below, 6 same tier, 1 one tier above. Upper half: 1 below, 6 same, 3 above. Bronze users have no "below" slots; those slots go to Bronze questions. |
| Pillar | 4 from the weakest pillar, 2 from each of the other three. If the student chose a pillar to practise, all 10 come from it. |
| Review | Up to 2 slots for questions the user got wrong, once they are due again: 1, 3 and then 7 days after the wrong answer. |
| New questions | At most 1 question that is still calibrating (fewer than 30 answers). |

Difficulty and pillar slots are filled together, e.g. one of the "same tier" slots is a "weakest pillar" slot. Review questions keep their own tier and replace a same-tier slot.

### Step 3: choose a question for each slot

Score every candidate that fits the slot and take the highest:

| Signal | Points |
| --- | --- |
| Linked to a reel or chapter the user consumed in the last 7 days (reel watched ≥ 3 s, chapter opened or page turned) | +3 |
| None of its tags appeared in the user's last 20 questions | +2 |
| Fewer than 100 answers in total (spreads exposure) | +1 |
| Random jitter | +0 to 1 |

**Topic spread.** No two questions in one quiz share a tag. In a single-pillar quiz, a tag can appear at most twice.

### Step 4: order

Easiest first and hardest last, with review questions mixed in. The explanation is shown after each answer.

### If there aren't enough questions

Relax the rules in this order until 10 questions are found (the engine relaxes slot by slot):
0. Allow more than one still-calibrating question. On a new database every question is calibrating.
1. Allow tiers two away from the user's.
2. Ignore the pillar mix.
3. Allow English for users with another language, marked "English only".
4. Allow questions answered correctly in the last 30 days. These still give 0 XP (SCORE.md).
5. Allow tags to repeat (topic spread).

## 5. Duels

- **Difficulty:** based on the skill tier of the two players' average rating. Rounds 1–2 are one tier below that tier, rounds 3–4 the same tier, and round 5 one tier above.
- **Topics:** one question per pillar plus one random pillar. If the challenger chose a pillar, all five come from it.
- **Fairness** (relaxed in this order when too few questions qualify: 30-day repeats, both languages, calibrating, then tier, then pillar):
  - Skip any question either player has answered in the last 30 days.
  - Each player sees their own language version, so a question qualifies only if it exists in both players' languages.
  - No review questions and no questions that are still calibrating.
- **Bot opponent:** plays at the user's rating. Its chance of answering correctly depends on the question's tier relative to the user's skill tier:
  - 85% for a tier below
  - 70% for the same tier
  - 45% for a tier above

  Its answer lands 6–15 seconds after the reveal; a wrong answer freezes it like a player (fastest finger, SCORE.md §4). The server rolls its answers and times when the duel starts and never sends them ahead. The student wins about half the time.

## 6. Learn chapter checks and reel checks

- **Chapter check:** a chapter links to 5–8 questions. Each attempt shows 5, preferring questions this user hasn't seen, easiest first. Questions answered correctly in the last 30 days give no XP but can still be shown.
- **Reel quiz:** after every 5 reels watched (a view of 3 s or more; skips don't count), 3 questions from the questions linked to those 5 reels, in the user's language. Prefer reels the student completed and questions they haven't seen, easiest first. If fewer than 3 are available, fill the rest with the practice rules (section 4) restricted to those reels' tags (from the reel manifest, so a reel with no linked questions still gets a quiz). A quiz with no questions isn't saved as an attempt, so it never clears the reel gate. Reels' `getCompletedReelIds` says which reels were completed.
- Each reel's linked question must be answerable from the reel alone.

## 7. Calibration

Authors set a question's tier at first. Once 30 users whose skill tier equals the question's tier have answered it:
- more than 85% correct → move it one tier down
- less than 35% correct → move it one tier up

Check this weekly, or after every 30 new answers. Retire a question when:
- more than 95% of answers are correct, or
- users report it as wrong.

## 8. Writing questions

- **Educate, never recommend.** Ask about concepts ("Why does spreading money across options reduce risk?"), never about a product ("Which fund should you buy?"). No brand, fund or stock names.
- **Indian context and rupees:** UPI, OTP, FD, SIP, PAN, chit funds and pocket money, with amounts in ₹ that a 17-year-old would recognise.
- **State assumptions** in numeric questions ("assume 7% a year; real returns vary").
- **MCQ wrong options** should be plausible mistakes, not jokes. Use "all of the above" sparingly.
- **Explanation:** at most 2 sentences, saying why the right answer is right.
- **Plain language** at a Class 9 reading level. Telugu and Hindi versions are checked by a native speaker before going `live`. Drafts live in `data/questions/drafts/<pillar>.<lang>.json` (`{ id, prompt, options, answer, explanation }` per question; not seeded). Once checked, merge them into `content.<lang>` and regenerate the seed. **Exception (2026-10-11):** all 185 te/hi versions were merged and seeded before that check, to get the demo working (IMPLEMENTATION.md, "Hindi and Telugu rendering"); the check is still owed and fixes go in through the JSON and a new seed migration.
- **AI-written questions** (Claude, from server code) are saved as `draft` with `source: ai`. A team member reviews them before they go `live`.
- **Demo target:** at least 15 live questions per pillar for Bronze and Silver, and 5 per pillar for Gold and above. That's 180 in total.
- **Where the bank lives:** `src/features/play/data/questions/<pillar>.json`, one object per question with the fields in section 2 and `content.en.{prompt, options, answer, explanation}`. `npm run test` checks it. After editing, regenerate the seed into a new migration: `node --experimental-strip-types src/features/play/data/seed.ts > supabase/migrations/<timestamp>_play_questions_seed.sql`.

## 9. Exports

Play exports these from `src/features/play/index.tsx` so Reels and Learn don't touch Play's tables directly:

- `pickQuestions({ context, pillar?, reelIds?, chapterSlug? })` (the count comes from the context) → an `attemptId` and the questions **without** their correct answers or explanations. When nothing can be picked it returns `attemptId: ""` and no questions, and saves no attempt.
- `submitAnswer({ attemptId, questionId, answer, timeMs, try })`, which checks the answer, logs it, works out XP (SCORE.md §3), coins (QUIZ.md §6) and the rating change (SCORE.md §8), and calls `recordActivity()`. It returns the result with the correct answer and explanation, except after a wrong first try that can still be reattempted (QUIZ.md §3).
- `revealAnswer({ attemptId, questionId })` → the correct answer and explanation after a wrong first try ("Show answer"). It forfeits that question's reattempt.
- `getAttemptResult(attemptId)` → `{ context, chapterSlug, correct, total, firstCheck }`, or `null` if the attempt isn't the signed-in student's. `firstCheck` is false when the student answered anything in an earlier check of the same chapter. Server-only (`@/features/play/server`), not an action; Learn uses it for the chapter bonus after checking `context` and `chapterSlug`.
- `getLastFinishedAt(context)` → when the student last finished a quiz of that context (every question has a first try), for the Reels gate. Any finished reel quiz resets the gate, not only the one on the 5 gated reels (attempts don't store reel ids); accepted for the demo, since it earns nothing extra.
- `getRecentWrongTags()` → tags of questions the signed-in student answered wrong in the last 7 days (quiz first tries and duels), for the recommendation remediation rule. Server-only (`@/features/play/server`).

None of these takes a user id. They read the signed-in user from `getCurrentProfile()` on the server, so a student can only answer, and only see history, as themselves. See IMPLEMENTATION.md §6 for the checks behind each call.
